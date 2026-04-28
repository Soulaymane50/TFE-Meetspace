CREATE DATABASE IF NOT EXISTS `meetspace` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `meetspace`;

-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: professionnelhost    Database: meetspace
-- ------------------------------------------------------
-- Server version	8.4.7

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `action` enum('EVENT_APPROVE','EVENT_CANCEL','EVENT_CREATE','EVENT_DELETE','EVENT_REGISTRATION_CANCEL','EVENT_REGISTRATION_CREATE','EVENT_REJECT','EVENT_UPDATE','PARKING_RESERVATION_APPROVE','PARKING_RESERVATION_CANCEL','PARKING_RESERVATION_CREATE','PARKING_RESERVATION_REJECT','PARKING_SESSION_CREATE','PARKING_SESSION_DELETE','PARKING_SESSION_UPDATE','LOGIN_FAILURE','LOGIN_SUCCESS','LOGOUT','PASSWORD_CHANGE','PASSWORD_RESET_COMPLETE','PASSWORD_RESET_REQUEST','PAYMENT_FAILURE','PAYMENT_INITIATED','PAYMENT_SUCCESS','RESERVATION_APPROVE','RESERVATION_CANCEL','RESERVATION_CREATE','RESERVATION_REJECT','RESERVATION_UPDATE','SPACE_CREATE','SPACE_DELETE','SPACE_UPDATE','USER_CREATE','USER_DELETE','USER_ROLE_CHANGE','USER_STATUS_CHANGE','USER_UPDATE') NOT NULL,
  `details` text,
  `entity_id` bigint DEFAULT NULL,
  `entity_type` varchar(50) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `new_value` text,
  `old_value` text,
  `timestamp` datetime(6) NOT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_entity` (`entity_type`),
  KEY `idx_audit_timestamp` (`timestamp`),
  CONSTRAINT `FK4hgmr1fd9vhiotvwi7fcyn68h` FOREIGN KEY (`user_id`) REFERENCES `utilisateur` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=403 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `espace`
--

DROP TABLE IF EXISTS `espace`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `espace` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `type` enum('PREMIUM_ROOM','SALLE') NOT NULL,
  `capacity` int DEFAULT NULL,
  `base_price` double NOT NULL,
  `status` enum('AVAILABLE','UNAVAILABLE') NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `espace`
--

LOCK TABLES `espace` WRITE;
/*!40000 ALTER TABLE `espace` DISABLE KEYS */;
INSERT INTO `espace` VALUES
(1,'Salle Premium Orion','PREMIUM_ROOM',500,320,'AVAILABLE'),
(2,'Salle Premium Executive','PREMIUM_ROOM',300,260,'AVAILABLE'),
(3,'Salle Atlas','SALLE',100,130,'AVAILABLE'),
(4,'Salle Horizon','SALLE',50,90,'AVAILABLE'),
(5,'Salle Conseil Executive','PREMIUM_ROOM',20,190,'AVAILABLE');
/*!40000 ALTER TABLE `espace` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `espace_reservation`
--

DROP TABLE IF EXISTS `espace_reservation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `espace_reservation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `utilisateur_id` bigint NOT NULL,
  `espace_id` bigint NOT NULL,
  `start_date_time` datetime NOT NULL,
  `end_date_time` datetime NOT NULL,
  `total_price` double NOT NULL,
  `status` enum('APPROVED','CANCELLED','CONFIRMED','PENDING','PENDING_APPROVAL','REJECTED') NOT NULL,
  `version` bigint DEFAULT '0',
  `payment_intent_id` varchar(255) DEFAULT NULL,
  `justification` varchar(1000) DEFAULT NULL,
  `rejection_reason` varchar(500) DEFAULT NULL,
  `approved_by` bigint DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `utilisateur_id` (`utilisateur_id`),
  KEY `espace_id` (`espace_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `espace_reservation_ibfk_1` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur` (`id`),
  CONSTRAINT `espace_reservation_ibfk_2` FOREIGN KEY (`espace_id`) REFERENCES `espace` (`id`),
  CONSTRAINT `espace_reservation_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `utilisateur` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=362 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `espace_reservation`
--

LOCK TABLES `espace_reservation` WRITE;
/*!40000 ALTER TABLE `espace_reservation` DISABLE KEYS */;
/*!40000 ALTER TABLE `espace_reservation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `event`
--

DROP TABLE IF EXISTS `event`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text,
  `start_date_time` datetime NOT NULL,
  `end_date_time` datetime NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `location_type` enum('EXISTING_SPACE','EXTERNAL') NOT NULL DEFAULT 'EXTERNAL',
  `space_id` bigint DEFAULT NULL,
  `external_address` varchar(255) DEFAULT NULL,
  `capacity` int NOT NULL,
  `price` double DEFAULT NULL,
  `status` enum('PENDING_APPROVAL','PUBLISHED','CANCELLED','REJECTED') NOT NULL DEFAULT 'PENDING_APPROVAL',
  `version` bigint DEFAULT '0',
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `approved_by` bigint DEFAULT NULL,
  `rejection_reason` varchar(255) DEFAULT NULL,
  `parking_required` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `space_id` (`space_id`),
  KEY `created_by` (`created_by`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `event_ibfk_1` FOREIGN KEY (`space_id`) REFERENCES `espace` (`id`),
  CONSTRAINT `event_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `utilisateur` (`id`),
  CONSTRAINT `event_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `utilisateur` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3176 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `event`
--

LOCK TABLES `event` WRITE;
/*!40000 ALTER TABLE `event` DISABLE KEYS */;
INSERT INTO `event` VALUES
(3001,'Séminaire IA & Data','Séminaire professionnel dédié à l''IA, à la data et à leurs usages concrets en entreprise.','2026-05-05 09:00:00','2026-05-05 17:30:00','Salle Premium Executive','EXISTING_SPACE',2,NULL,120,120,'PUBLISHED',0,1111,'2026-03-01 09:00:00','2026-03-01 10:00:00',1111,NULL,1),
(3002,'Séminaire Leadership','Session professionnelle axée sur le management, la communication et la prise de décision.','2026-05-05 10:00:00','2026-05-05 13:00:00','Salle Atlas','EXISTING_SPACE',3,NULL,80,75,'PUBLISHED',0,1111,'2026-03-01 09:15:00','2026-03-01 10:05:00',1111,NULL,1),
(3003,'Conférence Stratégie Produit','Grande conférence destinée aux équipes produit, aux fondateurs et aux consultants autour de la priorisation et de la feuille de route.','2026-05-12 14:00:00','2026-05-12 18:00:00','Salle Premium Orion','EXISTING_SPACE',1,NULL,260,145,'PUBLISHED',0,1111,'2026-03-01 09:30:00','2026-03-01 10:10:00',1111,NULL,1),
(3004,'Séminaire Cybersécurité','Rencontre professionnelle consacrée aux risques, à la prévention et à la gouvernance cyber.','2026-05-19 17:00:00','2026-05-19 20:30:00','Salle Atlas','EXISTING_SPACE',3,NULL,95,80,'PUBLISHED',0,1111,'2026-03-01 09:45:00','2026-03-01 10:15:00',1111,NULL,1),
(3005,'Masterclass Marketing Digital','Atelier avancé pour les équipes marketing, growth et communication sur les leviers digitaux les plus performants.','2026-05-12 13:30:00','2026-05-12 17:00:00','Salle Atlas','EXISTING_SPACE',3,NULL,70,45,'PUBLISHED',0,1111,'2026-03-01 10:00:00','2026-03-01 10:20:00',1111,NULL,0),
(3006,'Table ronde Finance & Investissement','Échanges entre experts, dirigeants et investisseurs autour du financement, de la croissance et du pilotage financier.','2026-05-19 18:30:00','2026-05-19 21:30:00','Salle Horizon','EXISTING_SPACE',4,NULL,45,25,'PUBLISHED',0,1111,'2026-03-01 10:15:00','2026-03-01 10:25:00',1111,NULL,1),
(3007,'Meetup Innovation RH','Session dédiée aux pratiques RH, à la marque employeur et à l''expérience collaborateur.','2026-05-26 17:30:00','2026-05-26 20:00:00','Salle Atlas','EXISTING_SPACE',3,NULL,85,20,'PUBLISHED',0,1111,'2026-03-01 10:30:00','2026-03-01 10:35:00',1111,NULL,0),
(3008,'Workshop Infrastructure Cloud','Workshop technique en format atelier consacré à l''architecture cloud, à la fiabilité et à la performance applicative.','2026-05-12 09:00:00','2026-05-12 12:30:00','Salle Horizon','EXISTING_SPACE',4,NULL,50,40,'PUBLISHED',0,1111,'2026-03-01 10:45:00','2026-03-01 10:40:00',1111,NULL,1);
/*!40000 ALTER TABLE `event` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `event_registration`
--

DROP TABLE IF EXISTS `event_registration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_registration` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `utilisateur_id` bigint NOT NULL,
  `event_id` bigint NOT NULL,
  `number_of_participants` int NOT NULL DEFAULT '1',
  `total_price` double NOT NULL,
  `status` enum('CANCELLED','CONFIRMED','PENDING') NOT NULL,
  `version` bigint DEFAULT '0',
  `payment_intent_id` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `utilisateur_id` (`utilisateur_id`),
  KEY `event_id` (`event_id`),
  CONSTRAINT `event_registration_ibfk_1` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur` (`id`),
  CONSTRAINT `event_registration_ibfk_2` FOREIGN KEY (`event_id`) REFERENCES `event` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11597 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `event_registration`
--

LOCK TABLES `event_registration` WRITE;
/*!40000 ALTER TABLE `event_registration` DISABLE KEYS */;
/*!40000 ALTER TABLE `event_registration` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parking_reservation`
--

DROP TABLE IF EXISTS `parking_reservation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parking_reservation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `parking_slot_id` bigint NOT NULL,
  `reserved_spaces` int NOT NULL,
  `total_price` double NOT NULL,
  `status` enum('CONFIRMED','CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  `version` bigint DEFAULT '0',
  `payment_intent_id` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `parking_slot_id` (`parking_slot_id`),
  CONSTRAINT `parking_reservation_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `utilisateur` (`id`),
  CONSTRAINT `parking_reservation_ibfk_2` FOREIGN KEY (`parking_slot_id`) REFERENCES `parking_slot` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=247 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parking_reservation`
--

LOCK TABLES `parking_reservation` WRITE;
/*!40000 ALTER TABLE `parking_reservation` DISABLE KEYS */;
/*!40000 ALTER TABLE `parking_reservation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parking_slot`
--

DROP TABLE IF EXISTS `parking_slot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parking_slot` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(150) NOT NULL,
  `description` varchar(500) NOT NULL,
  `session_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `capacity` int NOT NULL,
  `parking_rate` double NOT NULL,
  `status` enum('OPEN','FULL','CANCELLED') NOT NULL DEFAULT 'OPEN',
  `version` bigint DEFAULT '0',
  `created_at` datetime NOT NULL,
  `event_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `parking_slot_event_id` (`event_id`),
  CONSTRAINT `parking_slot_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `event` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parking_slot`
--

LOCK TABLES `parking_slot` WRITE;
/*!40000 ALTER TABLE `parking_slot` DISABLE KEYS */;
INSERT INTO `parking_slot` VALUES
(1,'Accès parking - Séminaire IA & Data','Accès parking associé au Séminaire IA & Data.','2026-05-05','08:00:00','18:30:00',40,12,'OPEN',0,'2026-03-02 09:00:00',3001),
(2,'Accès parking - Séminaire Leadership','Accès parking associé au Séminaire Leadership.','2026-05-05','09:00:00','13:30:00',25,10,'OPEN',0,'2026-03-02 09:10:00',3002),
(3,'Accès parking - Conférence Stratégie Produit','Accès parking associé à la Conférence Stratégie Produit.','2026-05-12','13:00:00','18:30:00',55,10,'OPEN',0,'2026-03-02 09:20:00',3003),
(4,'Accès parking - Séminaire Cybersécurité','Accès parking associé au Séminaire Cybersécurité.','2026-05-19','16:30:00','21:00:00',30,8,'OPEN',0,'2026-03-02 09:30:00',3004),
(5,'Accès parking - Masterclass Marketing Digital','Accès parking associé à la Masterclass Marketing Digital.','2026-05-12','12:30:00','17:30:00',20,8,'OPEN',0,'2026-03-02 09:40:00',3005),
(6,'Accès parking - Table ronde Finance & Investissement','Accès parking associé à la Table ronde Finance & Investissement.','2026-05-19','17:30:00','22:00:00',16,8,'OPEN',0,'2026-03-02 09:50:00',3006),
(7,'Accès parking - Workshop Infrastructure Cloud','Accès parking associé au Workshop Infrastructure Cloud.','2026-05-12','08:00:00','13:00:00',18,8,'OPEN',0,'2026-03-02 10:00:00',3008);
/*!40000 ALTER TABLE `parking_slot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `utilisateur`
--

DROP TABLE IF EXISTS `utilisateur`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `utilisateur` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('ADMIN','MEMBER','ORGANIZER') NOT NULL,
  `status` enum('ACTIVE','BANNED','DELETED','INACTIVE') NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=1121 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `utilisateur`
--

LOCK TABLES `utilisateur` WRITE;
/*!40000 ALTER TABLE `utilisateur` DISABLE KEYS */;
INSERT INTO `utilisateur` VALUES
(1001,'Amine','Benali','amine.benali@hotmail.be','$2a$10$iys2pPn0qRd5Ck2DMjbFNuNhKKwRaXQtHM0W964Qc1DrmZ4k9CEUq','ADMIN','ACTIVE','2025-01-02 09:00:00','2025-12-10 16:39:54'),
(1002,'Sophie','Vandenberg','sophie.vandenberg@hotmail.be','$2a$10$iys2pPn0qRd5Ck2DMjbFNuNhKKwRaXQtHM0W964Qc1DrmZ4k9CEUq','ADMIN','ACTIVE','2025-01-02 09:05:00','2025-12-10 16:39:54'),
(1003,'Fatou','Diop','fatou.diop@hotmail.be','$2a$10$iys2pPn0qRd5Ck2DMjbFNuNhKKwRaXQtHM0W964Qc1DrmZ4k9CEUq','ORGANIZER','ACTIVE','2025-01-02 09:10:00','2025-12-10 16:39:54'),
(1004,'Mehdi','El Haddad','mehdi.elhaddad@hotmail.be','$2a$10$iys2pPn0qRd5Ck2DMjbFNuNhKKwRaXQtHM0W964Qc1DrmZ4k9CEUq','ORGANIZER','ACTIVE','2025-01-02 09:15:00','2025-12-10 16:39:54'),
(1005,'Charlotte','Dubois','charlotte.dubois@hotmail.be','$2a$10$iys2pPn0qRd5Ck2DMjbFNuNhKKwRaXQtHM0W964Qc1DrmZ4k9CEUq','ORGANIZER','ACTIVE','2025-01-02 09:20:00','2025-12-10 16:39:54'),
(1111,'admin','admin','admin@admin.admin','$2a$10$ChKHgow5LjSHbnDIYLnx0ef6rEmk9iegZOfKVAArWiHSI7bMTWNlm','ADMIN','ACTIVE','2025-12-10 15:32:34','2025-12-10 16:39:54'),
(1112,'Organisateur','MeetSpace','organisateur@meetspace.local','$2a$10$ChKHgow5LjSHbnDIYLnx0ef6rEmk9iegZOfKVAArWiHSI7bMTWNlm','ORGANIZER','ACTIVE','2025-12-10 16:56:17','2025-12-10 16:56:48'),
(1113,'Utilisateur','Test','utilisateur@meetspace.local','$2a$10$ChKHgow5LjSHbnDIYLnx0ef6rEmk9iegZOfKVAArWiHSI7bMTWNlm','MEMBER','ACTIVE','2025-12-10 20:27:28',NULL),
(1114,'Admin','Test','admin.test@meetspace.local','$2a$10$iys2pPn0qRd5Ck2DMjbFNuNhKKwRaXQtHM0W964Qc1DrmZ4k9CEUq','ADMIN','ACTIVE','2025-12-10 20:27:42','2025-12-10 20:56:37'),
(1115,'Organisateur','Test','organisateur.test@meetspace.local','$2a$10$iys2pPn0qRd5Ck2DMjbFNuNhKKwRaXQtHM0W964Qc1DrmZ4k9CEUq','ORGANIZER','ACTIVE','2025-12-10 20:29:14','2025-12-10 20:56:34'),
(1116,'Membre','Local','membre.local@meetspace.local','$2a$10$ChKHgow5LjSHbnDIYLnx0ef6rEmk9iegZOfKVAArWiHSI7bMTWNlm','MEMBER','ACTIVE','2025-12-15 14:32:47','2025-12-15 14:47:09'),
(1117,'Organisateur','Local','organisateur.local@meetspace.local','$2a$10$ChKHgow5LjSHbnDIYLnx0ef6rEmk9iegZOfKVAArWiHSI7bMTWNlm','ORGANIZER','ACTIVE','2025-12-15 14:33:08','2025-12-15 14:47:02'),
(1118,'Admin','Local','admin.local@meetspace.local','$2a$10$ChKHgow5LjSHbnDIYLnx0ef6rEmk9iegZOfKVAArWiHSI7bMTWNlm','ADMIN','ACTIVE','2025-12-15 14:33:27','2025-12-15 14:47:04'),
(1119,'Client','Demo','client.demo@meetspace.local','$2a$10$ChKHgow5LjSHbnDIYLnx0ef6rEmk9iegZOfKVAArWiHSI7bMTWNlm','MEMBER','ACTIVE','2026-04-26 12:00:00',NULL);
/*!40000 ALTER TABLE `utilisateur` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `espace_reservation` WRITE;
/*!40000 ALTER TABLE `espace_reservation` DISABLE KEYS */;
INSERT INTO `espace_reservation` VALUES
(351,1113,3,'2026-04-10 09:00:00','2026-04-10 12:00:00',330,'CONFIRMED',0,NULL,NULL,NULL,NULL,NULL,'2026-03-05 09:00:00'),
(352,1116,1,'2026-04-16 08:00:00','2026-04-16 18:00:00',1800,'PENDING_APPROVAL',0,NULL,'Presentation client executive','',NULL,NULL,'2026-03-06 10:00:00'),
(353,1003,5,'2026-04-22 14:00:00','2026-04-22 17:00:00',660,'APPROVED',0,NULL,'Session de preparation comite de direction',NULL,1111,'2026-03-08 11:15:00','2026-03-07 14:00:00'),
(354,1115,4,'2026-05-05 09:00:00','2026-05-05 11:00:00',170,'CANCELLED',0,NULL,'Atelier equipe operationnelle',NULL,NULL,NULL,'2026-03-09 16:20:00'),
(355,1004,2,'2026-05-20 13:00:00','2026-05-20 17:00:00',960,'CONFIRMED',0,NULL,'Comite investisseurs trimestriel',NULL,NULL,NULL,'2026-03-10 08:30:00');
/*!40000 ALTER TABLE `espace_reservation` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `event_registration` WRITE;
/*!40000 ALTER TABLE `event_registration` DISABLE KEYS */;
INSERT INTO `event_registration` VALUES
(11501,1113,3001,20,2400,'CONFIRMED',0,NULL,'2026-03-11 09:00:00'),
(11502,1116,3001,18,2160,'CONFIRMED',0,NULL,'2026-03-11 09:05:00'),
(11503,1003,3001,15,1800,'CONFIRMED',0,NULL,'2026-03-11 09:10:00'),
(11504,1004,3001,22,2640,'CONFIRMED',0,NULL,'2026-03-11 09:15:00'),
(11505,1005,3001,16,1920,'CONFIRMED',0,NULL,'2026-03-11 09:20:00'),
(11506,1112,3001,14,1680,'CONFIRMED',0,NULL,'2026-03-11 09:25:00'),
(11507,1115,3001,15,1800,'CONFIRMED',0,NULL,'2026-03-11 09:30:00'),
(11508,1117,3001,4,480,'CANCELLED',0,NULL,'2026-03-11 09:40:00'),
(11509,1113,3002,12,900,'CONFIRMED',0,NULL,'2026-03-11 10:00:00'),
(11510,1116,3002,10,750,'CONFIRMED',0,NULL,'2026-03-11 10:05:00'),
(11511,1003,3002,14,1050,'CONFIRMED',0,NULL,'2026-03-11 10:10:00'),
(11512,1004,3002,16,1200,'CONFIRMED',0,NULL,'2026-03-11 10:15:00'),
(11513,1005,3002,9,675,'CONFIRMED',0,NULL,'2026-03-11 10:20:00'),
(11514,1112,3002,15,1125,'CONFIRMED',0,NULL,'2026-03-11 10:25:00'),
(11515,1115,3002,3,225,'CANCELLED',0,NULL,'2026-03-11 10:35:00'),
(11516,1113,3003,8,1160,'CONFIRMED',0,NULL,'2026-03-11 11:00:00'),
(11517,1116,3003,12,1740,'CONFIRMED',0,NULL,'2026-03-11 11:05:00'),
(11518,1003,3003,10,1450,'CONFIRMED',0,NULL,'2026-03-11 11:10:00'),
(11519,1004,3003,14,2030,'CONFIRMED',0,NULL,'2026-03-11 11:15:00'),
(11520,1005,3003,6,870,'CONFIRMED',0,NULL,'2026-03-11 11:20:00'),
(11521,1112,3003,8,1160,'CONFIRMED',0,NULL,'2026-03-11 11:25:00'),
(11522,1113,3004,5,400,'CONFIRMED',0,NULL,'2026-03-11 12:00:00'),
(11523,1116,3004,8,640,'CONFIRMED',0,NULL,'2026-03-11 12:05:00'),
(11524,1003,3004,7,560,'CONFIRMED',0,NULL,'2026-03-11 12:10:00'),
(11525,1004,3004,11,880,'CONFIRMED',0,NULL,'2026-03-11 12:15:00'),
(11526,1112,3004,4,320,'CANCELLED',0,NULL,'2026-03-11 12:20:00'),
(11527,1113,3005,2,90,'CONFIRMED',0,NULL,'2026-03-11 13:00:00'),
(11528,1116,3005,3,135,'CONFIRMED',0,NULL,'2026-03-11 13:05:00'),
(11529,1003,3005,3,135,'CONFIRMED',0,NULL,'2026-03-11 13:10:00'),
(11530,1113,3006,4,100,'CONFIRMED',0,NULL,'2026-03-11 14:00:00'),
(11531,1116,3006,5,125,'CONFIRMED',0,NULL,'2026-03-11 14:05:00'),
(11532,1003,3006,3,75,'CONFIRMED',0,NULL,'2026-03-11 14:10:00'),
(11533,1004,3006,6,150,'CONFIRMED',0,NULL,'2026-03-11 14:15:00'),
(11534,1113,3007,2,40,'CONFIRMED',0,NULL,'2026-03-11 15:00:00'),
(11535,1116,3007,4,80,'CONFIRMED',0,NULL,'2026-03-11 15:05:00'),
(11536,1003,3007,6,120,'CONFIRMED',0,NULL,'2026-03-11 15:10:00'),
(11537,1113,3008,5,200,'CONFIRMED',0,NULL,'2026-03-11 16:00:00'),
(11538,1116,3008,7,280,'CONFIRMED',0,NULL,'2026-03-11 16:05:00'),
(11539,1003,3008,6,240,'CONFIRMED',0,NULL,'2026-03-11 16:10:00'),
(11540,1004,3008,9,360,'CONFIRMED',0,NULL,'2026-03-11 16:15:00');
/*!40000 ALTER TABLE `event_registration` ENABLE KEYS */;
UNLOCK TABLES;

LOCK TABLES `parking_reservation` WRITE;
/*!40000 ALTER TABLE `parking_reservation` DISABLE KEYS */;
INSERT INTO `parking_reservation` VALUES
(201,1113,1,8,96,'CONFIRMED',0,NULL,'2026-03-12 09:00:00'),
(202,1116,1,6,72,'CONFIRMED',0,NULL,'2026-03-12 09:05:00'),
(203,1003,1,5,60,'CONFIRMED',0,NULL,'2026-03-12 09:10:00'),
(204,1004,1,9,108,'CONFIRMED',0,NULL,'2026-03-12 09:15:00'),
(205,1112,1,7,84,'CONFIRMED',0,NULL,'2026-03-12 09:20:00'),
(206,1115,1,5,60,'CONFIRMED',0,NULL,'2026-03-12 09:25:00'),
(207,1113,2,4,40,'CONFIRMED',0,NULL,'2026-03-12 10:00:00'),
(208,1116,2,6,60,'CONFIRMED',0,NULL,'2026-03-12 10:05:00'),
(209,1003,2,5,50,'CONFIRMED',0,NULL,'2026-03-12 10:10:00'),
(210,1004,2,8,80,'CONFIRMED',0,NULL,'2026-03-12 10:15:00'),
(211,1113,3,3,30,'CONFIRMED',0,NULL,'2026-03-12 11:00:00'),
(212,1116,3,4,40,'CONFIRMED',0,NULL,'2026-03-12 11:05:00'),
(213,1003,3,2,20,'CONFIRMED',0,NULL,'2026-03-12 11:10:00'),
(214,1004,3,5,50,'CONFIRMED',0,NULL,'2026-03-12 11:15:00'),
(215,1113,4,2,16,'CONFIRMED',0,NULL,'2026-03-12 12:00:00'),
(216,1116,4,3,24,'CONFIRMED',0,NULL,'2026-03-12 12:05:00'),
(217,1003,4,4,32,'CONFIRMED',0,NULL,'2026-03-12 12:10:00'),
(218,1115,4,2,16,'CANCELLED',0,NULL,'2026-03-12 12:15:00'),
(219,1113,5,2,16,'CONFIRMED',0,NULL,'2026-03-12 13:00:00'),
(220,1113,6,3,24,'CONFIRMED',0,NULL,'2026-03-12 14:00:00'),
(221,1116,6,4,32,'CONFIRMED',0,NULL,'2026-03-12 14:05:00'),
(222,1003,6,5,40,'CONFIRMED',0,NULL,'2026-03-12 14:10:00'),
(223,1113,7,1,8,'CONFIRMED',0,NULL,'2026-03-12 15:00:00'),
(224,1116,7,3,24,'CONFIRMED',0,NULL,'2026-03-12 15:05:00'),
(225,1004,5,1,8,'CANCELLED',0,NULL,'2026-03-12 15:15:00');
/*!40000 ALTER TABLE `parking_reservation` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-16 11:31:23


