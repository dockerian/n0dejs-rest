USE `n0dejs-db`;
source database/versions/0.0.1.sql;

DELIMITER $$

DROP PROCEDURE IF EXISTS `insert_data`;

CREATE PROCEDURE `insert_data`()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    GET DIAGNOSTICS CONDITION 1 @sqlstate = RETURNED_SQLSTATE, @errno = MYSQL_ERRNO, @text = MESSAGE_TEXT;
    SET @full_error = CONCAT("ERROR ", @errno, " (", @sqlstate, "): ", @text);
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = @full_error;
  END;

  SELECT version INTO @version FROM dbversion WHERE version = '1.0.1';

  IF @version = '1.0.1'
  THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Version 1.0.1 already present';
  END IF;

  START TRANSACTION;

  --
  -- Dumping data for table `credential_type`
  --

  INSERT INTO `credential_type` VALUES (1,'USERNAME_PASSWORD','Username & Password'),(2,'OAUTH2_TOKEN','OAuth2 Token'),(3,'AWS_ACCESS_KEY','AWS Access Key'),(4,'PKI','Public/Private Key'),(5,'CLIENT_ID_SECRET','OAuth Application Client ID & Secret');

  --
  -- Dumping data for table `image_registry`
  --

  INSERT INTO `image_registry` VALUES (1,'https://registry-1.docker.io','DockerHub 2.0', false),(2,@IMAGE_REGISTRY_URL,'foo_system_registry', true);


  --
  -- Dumping data for table `build_container`
  --
  INSERT INTO `build_container` VALUES
    (1,1,'Python build container', false),
    (2,2,'N0deJS build container', false),
    (3,3,'Java Maven build container', false),
    (4,4,'PHP build container', false),
    (5,5,'Golang build container', false),
    (6,6,'Ruby build container', false);

  --
  -- Dumping data for table `vcs_type`
  --
  INSERT INTO `vcs_type` VALUES (1,'GITHUB','GitHub.com','github_octocat.png','Connect your Github account to create a delivery pipeline based on a repository and specific branch of your choosing. Any subsequent code changes to that branch will trigger the delivery pipeline.'),(3,'BITBUCKET','Bitbucket','bitbucket.png','Connect your Bitbucket Server to create a delivery pipeline based on a repository and specific branch of your choosing. Any subsequent code changes to that branch will trigger the delivery pipeline.');

  --
  -- Dumping data for table `vcs`
  --
  INSERT INTO `vcs` VALUES (1,'https://github.com','https://api.github.com','Public GitHub.com vcs server',1,NULL,FALSE),(2,'https://bitbucket.org','https://api.bitbucket.org/2.0','Public BitBucket.org vcs server',3,NULL,FALSE);

  INSERT INTO dbversion (version, description) VALUES ('1.0.1', 'Initial data import.');

  COMMIT;

END$$

DELIMITER ;

CALL insert_data();
