-- Keeps the local demonstration catalogue useful when its dated fixtures become stale.
-- Safe to run repeatedly: dates only move when every relevant item is already in the past.

START TRANSACTION;

SET @first_event_date = (SELECT MIN(DATE(start_date_time)) FROM event);
SET @last_event_date = (SELECT MAX(DATE(end_date_time)) FROM event);
SET @event_shift_days = IF(
    @first_event_date IS NOT NULL
        AND @last_event_date < DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY),
    DATEDIFF(DATE_ADD(CURRENT_DATE, INTERVAL 35 DAY), @first_event_date),
    0
);

UPDATE event
SET start_date_time = ADDDATE(start_date_time, @event_shift_days),
    end_date_time = ADDDATE(end_date_time, @event_shift_days)
WHERE @event_shift_days > 0;

UPDATE parking_slot
SET session_date = ADDDATE(session_date, @event_shift_days)
WHERE @event_shift_days > 0;

SET @first_reservation_date = (SELECT MIN(DATE(start_date_time)) FROM espace_reservation);
SET @last_reservation_date = (SELECT MAX(DATE(end_date_time)) FROM espace_reservation);
SET @reservation_shift_days = IF(
    @first_reservation_date IS NOT NULL
        AND @last_reservation_date < DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY),
    DATEDIFF(DATE_ADD(CURRENT_DATE, INTERVAL 21 DAY), @first_reservation_date),
    0
);

UPDATE espace_reservation
SET start_date_time = ADDDATE(start_date_time, @reservation_shift_days),
    end_date_time = ADDDATE(end_date_time, @reservation_shift_days)
WHERE @reservation_shift_days > 0;

COMMIT;

SELECT @event_shift_days AS event_shift_days,
       @reservation_shift_days AS reservation_shift_days;
