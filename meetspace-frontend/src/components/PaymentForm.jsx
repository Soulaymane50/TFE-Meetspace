import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { signalSessionExpired } from "../utils/authSession";
import { formatCardNumber, formatExpiry, isValidCardNumber, isValidExpiry } from "../utils/paymentValidation";
import { formatMoney, normalizeLocale } from "../utils/formatters";
import styles from "./PaymentForm.module.css";

const API_URL = `${import.meta.env.VITE_API_URL || ""}/api`;
const LOCAL_PAYMENT_DELAY_MS = 700;
const ALLOW_LOCAL_PAYMENTS =
  import.meta.env.DEV && import.meta.env.VITE_ALLOW_LOCAL_PAYMENTS !== "false";

function isValidStripePublicKey(key) {
  return typeof key === "string" && /^pk_(test|live)_/.test(key) && !key.includes("xxxx");
}

const stripePromises = new Map();

function getStripePromise(key) {
  if (!stripePromises.has(key)) stripePromises.set(key, loadStripe(key));
  return stripePromises.get(key);
}

function createCardOptions(theme) {
  const dark = theme === "dark";
  return {
    hidePostalCode: true,
    style: {
      base: {
        color: dark ? "#f8fafc" : "#1e3455",
        iconColor: dark ? "#cbd5e1" : "#1e3455",
        fontFamily: '"Poppins", "Segoe UI", system-ui, sans-serif',
        fontSmoothing: "antialiased",
        fontSize: "16px",
        "::placeholder": { color: dark ? "#94a3b8" : "#807d75" },
      },
      invalid: { color: dark ? "#fca5a5" : "#b4532f", iconColor: dark ? "#fca5a5" : "#b4532f" },
    },
  };
}

function CheckoutForm({ amount, description, reservationType, metadata, onSuccess, onCancel, token }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const cardOptions = useMemo(() => createCardOptions(theme), [theme]);
  const formattedAmount = formatMoney(amount, normalizeLocale(i18n.language));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/payments/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency: "eur",
          description,
          reservationType,
          ...metadata,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) signalSessionExpired();
        let errorMessage = t("payment.error");
        const text = await response.text();
        try {
          const errorData = JSON.parse(text);
          if (errorData?.message) {
            errorMessage = errorData.message;
          } else if (errorData?.error) {
            errorMessage = errorData.error;
          } else if (errorData?.reason) {
            errorMessage = errorData.reason;
          }
        } catch {
          if (text) errorMessage = text;
        }
        throw new Error(errorMessage);
      }

      const { clientSecret } = await response.json();

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });

      if (result.error) {
        setError(result.error.message);
      } else if (result.paymentIntent.status === "succeeded") {
        onSuccess(result.paymentIntent.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formHeader}>
        <div>
          <p className={styles.kicker}>{t("payment.secure")}</p>
          <h2 className={styles.title}>{t("payment.cardInfo")}</h2>
        </div>
        <span className={styles.badge}>SSL</span>
      </div>

      <div className={styles.summary}>
        <p className={styles.description}>{description}</p>
        <p className={styles.amount}>
          {formattedAmount}
        </p>
      </div>

      <div className={styles.cardContainer}>
        <span className={styles.label} id="card-element-label">{t("payment.cardInfo")}</span>
        <div className={styles.cardElement} role="group" aria-labelledby="card-element-label">
          <CardElement options={cardOptions} />
        </div>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.buttonGroup}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className={styles.submitButton}
        >
          {loading ? t("payment.processing") : `${t("payment.pay")} ${formattedAmount}`}
        </button>
      </div>

      <div className={styles.securityBadge}>SSL - {t("payment.securedBy")}</div>
    </form>
  );
}

function LocalCheckoutForm({ amount, description, reservationType, metadata, onSuccess, onCancel, token }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const { t, i18n } = useTranslation();
  const formattedAmount = formatMoney(amount, normalizeLocale(i18n.language));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (cardHolder.trim().length < 2 || !isValidCardNumber(cardNumber) || !isValidExpiry(expiry) || !/^\d{3,4}$/.test(cvc)) {
      setError(t("payment.cardValidationError"));
      return;
    }

    setLoading(true);

    window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/payments/create-local-payment-intent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: Math.round(amount * 100),
            currency: "eur",
            description,
            reservationType,
            ...metadata,
          }),
        });
        if (!response.ok) {
          if (response.status === 401) signalSessionExpired();
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || payload.error || t("payment.error"));
        }
        const payload = await response.json();
        onSuccess(payload.paymentIntentId);
      } catch (requestError) {
        setError(requestError.message || t("payment.error"));
      } finally {
        setLoading(false);
      }
    }, LOCAL_PAYMENT_DELAY_MS);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formHeader}>
        <div>
          <p className={styles.kicker}>{t("payment.secure")}</p>
          <h2 className={styles.title}>{t("payment.cardInfo")}</h2>
        </div>
        <span className={styles.badge}>SSL</span>
      </div>

      <div className={styles.summary}>
        <p className={styles.description}>{description}</p>
        <p className={styles.amount}>
          {formattedAmount}
        </p>
      </div>

      <div className={styles.cardFieldsGrid}>
        <label className={styles.cardField}>
          <span>{t("payment.cardHolder")}</span>
          <input
            name="cardholder"
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value.slice(0, 100))}
            autoComplete="cc-name"
            maxLength={100}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "local-payment-error" : undefined}
            placeholder={t("payment.cardHolderPlaceholder")}
          />
        </label>
        <label className={styles.cardField}>
          <span>{t("payment.cardNumber")}</span>
          <input
            name="cardnumber"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            inputMode="numeric"
            autoComplete="cc-number"
            maxLength={23}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "local-payment-error" : undefined}
            placeholder="1234 5678 9012 3456"
          />
        </label>
        <label className={styles.cardField}>
          <span>{t("payment.expiry")}</span>
          <input
            name="expiry"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            inputMode="numeric"
            autoComplete="cc-exp"
            maxLength={5}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "local-payment-error" : undefined}
            placeholder={t("payment.expiryPlaceholder")}
          />
        </label>
        <label className={styles.cardField}>
          <span>{t("payment.cvc")}</span>
          <input
            name="cvc"
            value={cvc}
            onChange={(e) => setCvc((e.target.value.match(/\d/g) || []).slice(0, 4).join(""))}
            inputMode="numeric"
            autoComplete="cc-csc"
            maxLength={4}
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "local-payment-error" : undefined}
            placeholder={t("payment.cvcPlaceholder")}
          />
        </label>
      </div>

      {error && <div className={styles.error} id="local-payment-error" role="alert">{error}</div>}

      <div className={styles.buttonGroup}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>
          {t("common.cancel")}
        </button>
        <button type="submit" disabled={loading} className={styles.submitButton}>
          {loading ? t("payment.processing") : `${t("payment.pay")} ${formattedAmount}`}
        </button>
      </div>

      <div className={styles.securityBadge}>SSL - {t("payment.securedBy")}</div>
    </form>
  );
}

function PaymentUnavailable({ onCancel }) {
  const { t } = useTranslation();

  return (
    <div className={styles.form}>
      <div className={styles.formHeader}>
        <div>
          <p className={styles.kicker}>{t("payment.secure")}</p>
          <h2 className={styles.title}>{t("payment.unavailableTitle")}</h2>
        </div>
        <span className={styles.badge}>SSL</span>
      </div>

      <div className={styles.error} role="alert">{t("payment.unavailableMessage")}</div>

      <div className={styles.buttonGroup}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function PaymentConfigurationLoading() {
  const { t } = useTranslation();

  return (
    <div className={styles.form} aria-live="polite" aria-busy="true">
      <div className={styles.formHeader}>
        <div>
          <p className={styles.kicker}>{t("payment.secure")}</p>
          <h2 className={styles.title}>{t("payment.cardInfo")}</h2>
        </div>
        <span className={styles.badge}>SSL</span>
      </div>
      <div className={styles.summary}>
        <p className={styles.description}>{t("common.loading")}</p>
      </div>
    </div>
  );
}

export default function PaymentForm({ stripePublicKey, token, ...props }) {
  const initialKey = isValidStripePublicKey(stripePublicKey) ? stripePublicKey.trim() : "";
  const [runtimeConfiguration, setRuntimeConfiguration] = useState({ publicKey: "", loaded: false });

  useEffect(() => {
    if (initialKey) {
      return undefined;
    }

    const controller = new AbortController();
    fetch(`${API_URL}/payments/config`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) signalSessionExpired();
        if (!response.ok) return null;
        return response.json();
      })
      .then((configuration) => {
        const runtimeKey = configuration?.enabled ? configuration.publicKey : "";
        setRuntimeConfiguration({
          publicKey: isValidStripePublicKey(runtimeKey) ? runtimeKey.trim() : "",
          loaded: true,
        });
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setRuntimeConfiguration({ publicKey: "", loaded: true });
        }
      });

    return () => controller.abort();
  }, [initialKey, token]);

  const resolvedPublicKey = initialKey || runtimeConfiguration.publicKey;
  const loadingConfiguration = !initialKey && !runtimeConfiguration.loaded;

  if (loadingConfiguration) {
    return <PaymentConfigurationLoading />;
  }

  if (!isValidStripePublicKey(resolvedPublicKey)) {
    if (ALLOW_LOCAL_PAYMENTS) {
      return <LocalCheckoutForm {...props} token={token} />;
    }

    return <PaymentUnavailable onCancel={props.onCancel} />;
  }

  const stripePromise = getStripePromise(resolvedPublicKey);

  return (
    <Elements stripe={stripePromise} key={resolvedPublicKey}>
      <CheckoutForm {...props} token={token} />
    </Elements>
  );
}
