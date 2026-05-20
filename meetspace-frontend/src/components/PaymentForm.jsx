import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useTranslation } from "react-i18next";
import { formatMoney, normalizeLocale } from "../utils/formatters";
import styles from "./PaymentForm.module.css";

const API_URL = `${import.meta.env.VITE_API_URL || ""}/api`;
const LOCAL_PAYMENT_DELAY_MS = 700;
const ALLOW_LOCAL_PAYMENTS =
  import.meta.env.DEV && import.meta.env.VITE_ALLOW_LOCAL_PAYMENTS !== "false";

function isValidStripePublicKey(key) {
  return typeof key === "string" && /^pk_(test|live)_/.test(key) && !key.includes("xxxx");
}

const cardStyle = {
  hidePostalCode: true,
  style: {
    base: {
      color: "#1e3455",
      fontFamily: '"Poppins", "Segoe UI", system-ui, sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#a4a197",
      },
    },
    invalid: {
      color: "#c27546",
      iconColor: "#c27546",
    },
  },
};

function CheckoutForm({ amount, description, reservationType, metadata, onSuccess, onCancel, token }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { t, i18n } = useTranslation();
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
        <label className={styles.label}>{t("payment.cardInfo")}</label>
        <div className={styles.cardElement}>
          <CardElement options={cardStyle} />
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

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

function LocalCheckoutForm({ amount, description, reservationType, onSuccess, onCancel }) {
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

    if (!cardHolder.trim() || cardNumber.replace(/\s/g, "").length < 12 || !expiry.trim() || cvc.trim().length < 3) {
      setError(t("payment.cardValidationError"));
      return;
    }

    setLoading(true);

    window.setTimeout(() => {
      onSuccess(`test_${reservationType.toLowerCase()}_${Date.now()}`);
      setLoading(false);
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
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value)}
            autoComplete="cc-name"
            placeholder="Nom du titulaire"
          />
        </label>
        <label className={styles.cardField}>
          <span>{t("payment.cardNumber")}</span>
          <input
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1234 5678 9012 3456"
          />
        </label>
        <label className={styles.cardField}>
          <span>{t("payment.expiry")}</span>
          <input
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/AA"
          />
        </label>
        <label className={styles.cardField}>
          <span>{t("payment.cvc")}</span>
          <input
            value={cvc}
            onChange={(e) => setCvc(e.target.value)}
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="CVC"
          />
        </label>
      </div>

      {error && <div className={styles.error}>{error}</div>}

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

      <div className={styles.error}>{t("payment.unavailableMessage")}</div>

      <div className={styles.buttonGroup}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

export default function PaymentForm({ stripePublicKey, token, ...props }) {
  if (!isValidStripePublicKey(stripePublicKey)) {
    if (ALLOW_LOCAL_PAYMENTS) {
      return <LocalCheckoutForm {...props} />;
    }

    return <PaymentUnavailable onCancel={props.onCancel} />;
  }

  const stripePromise = loadStripe(stripePublicKey);

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} token={token} />
    </Elements>
  );
}
