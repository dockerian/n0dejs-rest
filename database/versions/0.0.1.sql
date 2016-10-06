-- MySQL dump 11.13  Distrib 5.6.30-76.3, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: n0dejs-db
-- ------------------------------------------------------
-- Server version	5.6.30-76.3-56

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40015 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

USE `n0dejs-db`;

DELIMITER $$

DROP PROCEDURE IF EXISTS `create_schema`;

CREATE PROCEDURE `create_schema`()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1 @sqlstate = RETURNED_SQLSTATE, @errno = MYSQL_ERRNO, @text = MESSAGE_TEXT;
    SET @full_error = CONCAT("ERROR ", @errno, " (", @sqlstate, "): ", @text);
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @full_error;
  END;

  SELECT COUNT(1) INTO @version_table_exists FROM information_schema.tables WHERE table_schema = 'n0dejs-db' AND table_name = 'dbversion';

  IF @version_table_exists = 1
  THEN
    SELECT version INTO @version FROM dbversion WHERE version = '0.0.1';
    IF @version = '0.0.1'
    THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Version 0.0.1 already present';
    END IF;
  END IF;

  START TRANSACTION;

  --
  -- Table structure for table `build_container`
  --
  DROP TABLE IF EXISTS `build_container`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `build_container` (
    `build_container_id` int(11) NOT NULL AUTO_INCREMENT,
    `build_container_image_id` int(11) NOT NULL,
    `build_container_label` varchar(255) NOT NULL,
    PRIMARY KEY (`build_container_id`),
    UNIQUE KEY `build_container_id_uindex` (`build_container_id`),
    UNIQUE KEY `build_container_label_uindex` (`build_container_label`),
    KEY `build_container_image_id_fk` (`build_container_image_id`),
    CONSTRAINT `build_container_image_id_fk` FOREIGN KEY (`build_container_image_id`) REFERENCES `image` (`image_id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8 COMMENT='Models a build container instance (in which a project of a certain type is built/tested), e.g. "Java", "PHP", etc. ';
  /*!40101 SET character_set_client = @saved_cs_client */;

  --
  -- Table structure for table `credential`
  --
  DROP TABLE IF EXISTS `credential`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `credential` (
    `credential_id` int(11) NOT NULL AUTO_INCREMENT,
    `credential_type_id` int(11) NOT NULL,
    `credential_key` varchar(512) DEFAULT NULL,
    `credential_value` longtext,
    `credential_extra` longtext,
    `owner_id` int(11) DEFAULT NULL,
    `label` varchar(512) DEFAULT NULL,
    `created` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
    `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`credential_id`),
    UNIQUE KEY `credential_id_uindex` (`credential_id`),
    KEY `credential_credential_type_credential_type_id_fk` (`credential_type_id`),
    KEY `credential_owner_user_id_fk` (`owner_id`),
    CONSTRAINT `credential_owner_user_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `user` (`user_id`),
    CONSTRAINT `credential_type_id_fk` FOREIGN KEY (`credential_type_id`) REFERENCES `credential_type` (`credential_type_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
  /*!40101 SET character_set_client = @saved_cs_client */;

  --
  -- Table structure for table `credential_type`
  --
  DROP TABLE IF EXISTS `credential_type`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `credential_type` (
    `credential_type_id` int(11) NOT NULL AUTO_INCREMENT,
    `credential_type` varchar(255) NOT NULL,
    `credential_type_label` varchar(255) NOT NULL,
    PRIMARY KEY (`credential_type_id`),
    UNIQUE KEY `credential_type_id_uindex` (`credential_type_id`),
    UNIQUE KEY `credential_type_uindex` (`credential_type`),
    UNIQUE KEY `credential_type_label_uindex` (`credential_type_label`)
  ) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8;
  /*!40101 SET character_set_client = @saved_cs_client */;

  --
  -- Table structure for table `dbversion`
  --
  DROP TABLE IF EXISTS `dbversion`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `dbversion` (
    `version` varchar(20) NOT NULL,
    `description` varchar(200) DEFAULT NULL,
    `id` int(11) NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (`id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8;
  /*!40101 SET character_set_client = @saved_cs_client */;

  --
  -- Table structure for table `deployment`
  --
  DROP TABLE IF EXISTS `deployment`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `deployment` (
    `created_date` datetime NOT NULL,
    `browseUrl` varchar(255) DEFAULT NULL,
    `deployment_id` int(11) NOT NULL AUTO_INCREMENT,
    `build_id` int(11) NOT NULL,
    `active` tinyint(4) NOT NULL DEFAULT '1',
    PRIMARY KEY (`deployment_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
  /*!40101 SET character_set_client = @saved_cs_client */;

  --
  -- Table structure for table `deployment_target`
  --
  DROP TABLE IF EXISTS `deployment_target`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `deployment_target` (
    `name` varchar(255) NOT NULL,
    `type` varchar(255) NOT NULL,
    `url` varchar(255) DEFAULT NULL,
    `userName` varchar(255) DEFAULT NULL,
    `password` varchar(255) NOT NULL,
    `organization` varchar(255) DEFAULT NULL,
    `space` varchar(255) DEFAULT NULL,
    `deployment_target_id` int(11) NOT NULL AUTO_INCREMENT,
    `user_id` int(11) NOT NULL,
    `skip_ssl_validation` BOOLEAN DEFAULT false,
    PRIMARY KEY (`deployment_target_id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
  /*!40101 SET character_set_client = @saved_cs_client */;

  --
  -- Table structure for table `project`
  --
  DROP TABLE IF EXISTS `project`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `project` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(255) NOT NULL,
    `type` varchar(255) NOT NULL,
    `last_commit_sha` varchar(255) DEFAULT NULL,
    `token` varchar(255) DEFAULT NULL,
    `repo_owner` varchar(255) DEFAULT NULL,
    `repo_name` varchar(255) NOT NULL,
    `repo_branch` varchar(255) DEFAULT NULL,
    `repo_cloneUrl` varchar(255) DEFAULT NULL,
    `repo_httpUrl` varchar(255) DEFAULT NULL,
    `repo_sshUrl` varchar(255) DEFAULT NULL,
    `repo_githubRepoId` varchar(255) DEFAULT NULL,
    `repo_webHookId` varchar(255) DEFAULT NULL,
    `repo_webhookUrl` varchar(255) DEFAULT NULL,
    `repo_secret` varchar(255) DEFAULT NULL,
    `join_code` varchar(255) DEFAULT NULL,
    `user_id` int(11) NOT NULL,
    `credential_id` int(11) DEFAULT NULL,
    `application_image_id` int(11) DEFAULT NULL,
    `build_container_id` int(11) DEFAULT NULL,
    `deployment_target_id` int(11) NOT NULL,
    `vcs_id` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `application_image_id_fk` (`application_image_id`),
    KEY `project_vcs_id_fk` (`vcs_id`),
    KEY `project_credential_id_fk` (`credential_id`),
    CONSTRAINT `application_image_id_fk` FOREIGN KEY (`application_image_id`) REFERENCES `image` (`image_id`),
    CONSTRAINT `project_credential_id_fk` FOREIGN KEY (`credential_id`) REFERENCES `credential` (`credential_id`),
    CONSTRAINT `project_vcs_id_fk` FOREIGN KEY (`vcs_id`) REFERENCES `vcs` (`vcs_id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
  /*!40101 SET character_set_client = @saved_cs_client */;

  --
  -- Table structure for table `project_member`
  --
  DROP TABLE IF EXISTS `project_member`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `project_member` (
    `user_id` int(11) NOT NULL,
    `project_id` int(11) NOT NULL,
    KEY `user_id_index` (`user_id`),
    KEY `project_id_index` (`project_id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
  /*!40101 SET character_set_client = @saved_cs_client */;

  --
  -- Table structure for table `user`
  --
  DROP TABLE IF EXISTS `user`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `user` (
    `user_id` int(11) NOT NULL AUTO_INCREMENT,
    `username` varchar(255) NOT NULL,
    `uaa_id` varchar(255) NOT NULL,
    `created` datetime DEFAULT NULL,
    PRIMARY KEY (`user_id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;
  /*!40101 SET character_set_client = @saved_cs_client */;

  --
  -- Table structure for table `vcs`
  --
  DROP TABLE IF EXISTS `vcs`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `vcs` (
    `vcs_id` int(11) NOT NULL AUTO_INCREMENT,
    `vcs_type_id` int(11) DEFAULT NULL,
    `api_url` varchar(512) DEFAULT NULL,
    `browse_url` varchar(512) DEFAULT NULL,
    `credential_id` int(11) DEFAULT NULL,
    `label` varchar(255) NOT NULL,
    `skip_ssl_validation` BOOLEAN DEFAULT false,
    PRIMARY KEY (`vcs_id`),
    UNIQUE KEY `vcs_vcs_id_uindex` (`vcs_id`),
    UNIQUE KEY `vcs_label_uindex` (`label`),
    KEY `vcs_type_id_fk` (`vcs_type_id`),
    KEY `vcs_credential_id_fk` (`credential_id`),
    CONSTRAINT `vcs_credential_id_fk` FOREIGN KEY (`credential_id`) REFERENCES `credential` (`credential_id`),
    CONSTRAINT `vcs_type_id_fk` FOREIGN KEY (`vcs_type_id`) REFERENCES `vcs_type` (`vcs_type_id`)
  ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8 COMMENT='List of VCS instances. For example, "GitHub.com", "Bitbucket.org", "MyOrg IT GitHub Enterprise", "MyOrg Software GitHub Enterprise", etc.';
  /*!40101 SET character_set_client = @saved_cs_client */;

  --
  -- Table structure for table `vcs_type`
  --
  DROP TABLE IF EXISTS `vcs_type`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `vcs_type` (
    `vcs_type_id` int(11) NOT NULL AUTO_INCREMENT,
    `vcs_type` varchar(64) NOT NULL,
    `vcs_type_label` varchar(255) NOT NULL,
    `icon_url` varchar(255) DEFAULT NULL,
    `description` varchar(510) DEFAULT NULL,
    PRIMARY KEY (`vcs_type_id`),
    UNIQUE KEY `vcs_type_id_uindex` (`vcs_type_id`),
    UNIQUE KEY `vcs_type_label_uindex` (`vcs_type_label`),
    UNIQUE KEY `vcs_type_uindex` (`vcs_type`)
  ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8 COMMENT='Enumeration of Version Control System types. There is a canonical name, e.g. "github", "github_enterprise", "svn", and a display label, e.g. "GitHub", "GitHub Enterprise", "Subversion".';
  /*!40101 SET character_set_client = @saved_cs_client */;


  DROP TABLE IF EXISTS `system_configuration`;
  /*!40101 SET @saved_cs_client     = @@character_set_client */;
  /*!40101 SET character_set_client = utf8 */;
  CREATE TABLE `system_configuration` (
    `system_configuration_id` int(11) NOT NULL AUTO_INCREMENT,
    `key` varchar(64) NOT NULL,
    `value` varchar(255) NOT NULL,
    PRIMARY KEY (`system_configuration_id`),
    UNIQUE KEY `system_configuration_id_uindex` (`system_configuration_id`),
    UNIQUE KEY `key_uindex` (`key`)
  ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COMMENT='Used to hold configuration shared between n0dejs-api nodes that can be changed at runtime';
  /*!40101 SET character_set_client = @saved_cs_client */;
  /*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

  /*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
  /*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
  /*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
  /*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
  /*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
  /*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
  /*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

  INSERT INTO dbversion (version, description) VALUES ('0.0.1', 'Initial schema import');

  COMMIT;

END$$

DELIMITER ;

CALL create_schema();
