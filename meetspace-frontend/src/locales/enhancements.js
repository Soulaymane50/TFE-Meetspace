export default {
  fr: {
    common: { checking: "Vérification…", retry: "Réessayer", saving: "Enregistrement…", back: "Retour", amount: "Montant", status: "Statut" },
    auth: { sessionExpired: "Votre session a expiré. Reconnectez-vous pour reprendre exactement où vous vous étiez arrêté." },
    payment: { cardHolderPlaceholder: "Nom indiqué sur la carte", expiryPlaceholder: "MM/AA", cvcPlaceholder: "CVC" },
    finance: {
      allHistory: "Historique complet", periodRange: "Du {{from}} au {{to}}", updating: "Mise à jour…",
      breakdownHelp: "Comparez le revenu confirmé au potentiel du portefeuille.", viewLabel: "Présentation du détail",
      tableView: "Tableau", chartView: "Graphique", chartDescription: "Comparaison des revenus confirmés et potentiels par source"
    },
    system: {
      interfaceLoadingTitle: "Chargement", interfaceLoadingMessage: "Préparation de l’interface MeetSpace.",
      sessionCheckTitle: "Vérification", sessionCheckMessage: "Validation de votre session en cours.",
      appErrorTitle: "Cette page n’a pas pu s’afficher", appErrorMessage: "Vos données n’ont pas été modifiées. Rechargez la page pour reprendre votre parcours.",
      reload: "Recharger", backHome: "Retour à l’accueil",
      offlineTitle: "Vous êtes hors connexion",
      offlineMessage: "Les pages déjà ouvertes restent consultables. Les actions seront disponibles au retour du réseau.",
      apiUnavailableTitle: "Service momentanément indisponible",
      apiUnavailableMessage: "Le catalogue reste visible, mais les réservations et le compte nécessitent le service MeetSpace."
    },
    pwa: { title: "Installer MeetSpace", message: "Accédez plus vite à vos réservations depuis cet appareil.", install: "Installer", dismiss: "Fermer la proposition" },
    receipt: {
      title: "Justificatif", actions: "Actions du justificatif", booking: "Réservation", customer: "Client",
      disclaimer: "Ce document confirme la réservation. Il ne remplace pas une facture fiscale.",
      documentType: "Justificatif de réservation", issueDate: "Émis le", notFound: "Justificatif introuvable",
      notFoundHint: "Cette réservation n’existe pas dans votre compte.", parkingSpaces: "{{count}} place(s)",
      participants: "{{count}} participant(s)", print: "Imprimer ou enregistrer en PDF", reference: "Référence",
      roomBooking: "Location de salle", serviceDeliveredBy: "Service proposé par MeetSpace", open: "Ouvrir le justificatif"
    },
    reservation: {
      adjustmentEyebrow: "Ajustement du planning", confirmReschedule: "Confirmer le nouveau créneau",
      reschedule: "Déplacer", rescheduleHint: "La durée et le prix restent inchangés. Le déplacement est possible jusqu’à 24 heures avant le début.",
      rescheduleSuccessTitle: "Créneau mis à jour", rescheduleSuccessMessage: "Votre réservation a bien été déplacée."
    },
    events: {
      joinWaitlist: "Rejoindre la liste d’attente", waitlistHint: "Indiquez le nombre de places souhaitées. Nous vous préviendrons dès qu’elles se libèrent.",
      waitlistJoinedTitle: "Demande enregistrée", waitlistJoinedMessage: "Vous êtes maintenant sur la liste d’attente.",
      waitlist: "Liste d’attente", waitlistTitle: "Vos demandes en attente", waitlistDescription: "Vous serez prévenu lorsqu’un nombre suffisant de places sera disponible.",
      waiting: "En attente", placeAvailable: "Place disponible", completeRegistration: "Finaliser l’inscription",
      leaveWaitlist: "Quitter la liste", leaveWaitlistTitle: "Quitter la liste d’attente ?",
      leaveWaitlistMessage: "Vous ne recevrez plus d’alerte pour cet événement.", waitlistLeft: "Demande retirée"
    },
    notifications: { markAllRead: "Tout marquer comme lu", unreadLabel: "Notifications, {{count}} non lue(s)" }
  },
  en: {
    common: { checking: "Checking…", retry: "Try again", saving: "Saving…", back: "Back", amount: "Amount", status: "Status" },
    auth: { sessionExpired: "Your session has expired. Sign in again to continue exactly where you left off." },
    payment: { cardHolderPlaceholder: "Name shown on card", expiryPlaceholder: "MM/YY", cvcPlaceholder: "CVC" },
    finance: {
      allHistory: "Full history", periodRange: "{{from}} to {{to}}", updating: "Updating…",
      breakdownHelp: "Compare confirmed revenue with the portfolio potential.", viewLabel: "Detail presentation",
      tableView: "Table", chartView: "Chart", chartDescription: "Comparison of confirmed and potential revenue by source"
    },
    system: {
      interfaceLoadingTitle: "Loading", interfaceLoadingMessage: "Preparing the MeetSpace interface.",
      sessionCheckTitle: "Checking", sessionCheckMessage: "Validating your session.",
      appErrorTitle: "This page could not be displayed", appErrorMessage: "Your data has not been changed. Reload the page to continue.",
      reload: "Reload", backHome: "Back to home",
      offlineTitle: "You are offline",
      offlineMessage: "Previously opened pages remain available. Actions will return when the network is restored.",
      apiUnavailableTitle: "Service temporarily unavailable",
      apiUnavailableMessage: "The catalogue remains visible, but bookings and accounts require the MeetSpace service."
    },
    pwa: { title: "Install MeetSpace", message: "Reach your bookings faster from this device.", install: "Install", dismiss: "Dismiss suggestion" },
    receipt: {
      title: "Booking receipt", actions: "Receipt actions", booking: "Booking", customer: "Customer",
      disclaimer: "This document confirms the booking. It is not a tax invoice.", documentType: "Booking confirmation",
      issueDate: "Issued on", notFound: "Receipt not found", notFoundHint: "This booking does not exist in your account.",
      parkingSpaces: "{{count}} space(s)", participants: "{{count}} participant(s)", print: "Print or save as PDF",
      reference: "Reference", roomBooking: "Room hire", serviceDeliveredBy: "Service provided by MeetSpace", open: "Open receipt"
    },
    reservation: {
      adjustmentEyebrow: "Schedule adjustment", confirmReschedule: "Confirm new time",
      reschedule: "Reschedule", rescheduleHint: "Duration and price remain unchanged. Changes are possible until 24 hours before the start.",
      rescheduleSuccessTitle: "Time updated", rescheduleSuccessMessage: "Your booking has been rescheduled."
    },
    events: {
      joinWaitlist: "Join the waiting list", waitlistHint: "Tell us how many places you need. We will notify you when they become available.",
      waitlistJoinedTitle: "Request saved", waitlistJoinedMessage: "You are now on the waiting list.",
      waitlist: "Waiting list", waitlistTitle: "Your pending requests", waitlistDescription: "You will be notified when enough places are available.",
      waiting: "Waiting", placeAvailable: "Place available", completeRegistration: "Complete registration",
      leaveWaitlist: "Leave list", leaveWaitlistTitle: "Leave the waiting list?",
      leaveWaitlistMessage: "You will no longer receive an alert for this event.", waitlistLeft: "Request removed"
    },
    notifications: { markAllRead: "Mark all as read", unreadLabel: "Notifications, {{count}} unread" }
  },
  nl: {
    common: { checking: "Controleren…", retry: "Opnieuw proberen", saving: "Opslaan…", back: "Terug", amount: "Bedrag", status: "Status" },
    auth: { sessionExpired: "Uw sessie is verlopen. Meld u opnieuw aan om verder te gaan waar u gebleven was." },
    payment: { cardHolderPlaceholder: "Naam op de kaart", expiryPlaceholder: "MM/JJ", cvcPlaceholder: "CVC" },
    finance: {
      allHistory: "Volledige geschiedenis", periodRange: "Van {{from}} tot {{to}}", updating: "Bijwerken…",
      breakdownHelp: "Vergelijk bevestigde inkomsten met het potentieel van de portefeuille.", viewLabel: "Detailweergave",
      tableView: "Tabel", chartView: "Grafiek", chartDescription: "Vergelijking van bevestigde en potentiële inkomsten per bron"
    },
    system: {
      interfaceLoadingTitle: "Laden", interfaceLoadingMessage: "De MeetSpace-interface wordt voorbereid.",
      sessionCheckTitle: "Controleren", sessionCheckMessage: "Uw sessie wordt gecontroleerd.",
      appErrorTitle: "Deze pagina kon niet worden weergegeven", appErrorMessage: "Uw gegevens zijn niet gewijzigd. Laad de pagina opnieuw om verder te gaan.",
      reload: "Opnieuw laden", backHome: "Terug naar home",
      offlineTitle: "U bent offline",
      offlineMessage: "Eerder geopende pagina’s blijven beschikbaar. Acties zijn opnieuw mogelijk zodra het netwerk terug is.",
      apiUnavailableTitle: "Dienst tijdelijk niet beschikbaar",
      apiUnavailableMessage: "De catalogus blijft zichtbaar, maar reserveringen en accounts vereisen de MeetSpace-dienst."
    },
    pwa: { title: "MeetSpace installeren", message: "Open uw reserveringen sneller vanaf dit toestel.", install: "Installeren", dismiss: "Voorstel sluiten" },
    receipt: {
      title: "Reservatiebewijs", actions: "Acties voor het bewijs", booking: "Reservatie", customer: "Klant",
      disclaimer: "Dit document bevestigt de reservatie. Het is geen fiscale factuur.", documentType: "Reservatiebevestiging",
      issueDate: "Uitgegeven op", notFound: "Bewijs niet gevonden", notFoundHint: "Deze reservatie bestaat niet in uw account.",
      parkingSpaces: "{{count}} plaats(en)", participants: "{{count}} deelnemer(s)", print: "Afdrukken of opslaan als PDF",
      reference: "Referentie", roomBooking: "Zaalhuur", serviceDeliveredBy: "Dienst aangeboden door MeetSpace", open: "Bewijs openen"
    },
    reservation: {
      adjustmentEyebrow: "Planning aanpassen", confirmReschedule: "Nieuw tijdstip bevestigen",
      reschedule: "Verplaatsen", rescheduleHint: "Duur en prijs blijven ongewijzigd. Wijzigen kan tot 24 uur voor de start.",
      rescheduleSuccessTitle: "Tijdstip bijgewerkt", rescheduleSuccessMessage: "Uw reservatie is verplaatst."
    },
    events: {
      joinWaitlist: "Op de wachtlijst", waitlistHint: "Geef het gewenste aantal plaatsen aan. Wij verwittigen u zodra ze beschikbaar zijn.",
      waitlistJoinedTitle: "Aanvraag opgeslagen", waitlistJoinedMessage: "U staat nu op de wachtlijst.",
      waitlist: "Wachtlijst", waitlistTitle: "Uw lopende aanvragen", waitlistDescription: "U ontvangt een melding zodra voldoende plaatsen beschikbaar zijn.",
      waiting: "In afwachting", placeAvailable: "Plaats beschikbaar", completeRegistration: "Inschrijving afronden",
      leaveWaitlist: "Wachtlijst verlaten", leaveWaitlistTitle: "De wachtlijst verlaten?",
      leaveWaitlistMessage: "U ontvangt geen melding meer voor dit evenement.", waitlistLeft: "Aanvraag verwijderd"
    },
    notifications: { markAllRead: "Alles als gelezen markeren", unreadLabel: "Meldingen, {{count}} ongelezen" }
  }
};
