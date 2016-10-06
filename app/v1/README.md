# N0deJS REST API - Express Application

This directory exports an [express-js](https://github.com/expressjs/express) application with ```index.js``` in this directory that is mounted onto an HTTP endpoint by ```server.js``` in project root directory.

 - [Directory & Code Layout](#directory--code-layout)
 - [Middleware](#middleware)
 - [Authentication](#authentication)
 - [Versions](#versions)



## Directory & Code Layout
We use directories to layout code.

## Middleware
Middleware logic in ```middleware.js``` is mounted by ```index.js``` onto ```api.use()``` to separate routing logic from the actual middleware logic.

### Authentication
Authentication is required for all requests. This is done by way of tokens appended to each request, instead of using sessions.

#### Provider & Configuration
The authentication provider uses environment variables:
 - **AUTH_ENDPOINT**: The zone subdomain for a service (e.g. `api`) to authenticate against, for example `api.domain.net`, where `domain.net` is the default zone.
 - **AUTH_CERTIFICATE**: The public certificate passed in as a string. This is used for decrypting the JSON Web Token (JWT).

This UAA server will be an instance implements OAuth2 authentication protocol.

Note: *Authentication expects all user data to already exist in the zone, this is achieved by the customer using LDAP to call back the UAA service. Generally, the larger UCP UAA instance will be backed by an LDAP server - this will allow the users to use the same credentials in all zones / applications on UCP. If the customer chooses not to use LDAP, they will need to populate credentials into the zone.*

#### Authentication Process
Once the client or third-party service has authenticated, they will be provided with a [JSON Web Token](https://jwt.io/) encrypted by the zone's certificate.

##### Basic Auth
Basic auth is supported according to the (UAA documentation)[https://github.com/cloudfoundry/uaa/blob/master/docs/UAA-APIs.rst#oauth2-token-endpoint-post-oauth-token].
 - When API is deployed, a script will run to inject a known client-id/client-secret into our UAA zone. This same id and secret will be baked into the client.
 - The client will make a request to the API ```/info``` endpoint to retrieve the UAA service URL.
 - The client will then make a request to the UAA server providing the id, secret, username, and password. The UAA server will respond with a token.
 - This token is to be used as a bearer token on all other requests to the API-rest-service endpoints.

##### OAuth
 - An application registers as a client against the zone with a ```client-id``` and ```client-secret``` (similar to OAuth Applications on Github).
 - Using authenticated (logged in) user credentials to obtain a token from the zone.
 - Such token will then be provided on all other requests to the API endpoints.



## Versions
##### API v1
** Deprecated**
API v1 behavior is no longer supported. (This is to demonstrate deprecated older version)

##### API v2
The API v2 is the latest version and is currently in progress.
