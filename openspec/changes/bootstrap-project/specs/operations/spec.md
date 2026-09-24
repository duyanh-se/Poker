# Operations Specification Delta

## Added Requirements

### Service health endpoint

The system SHALL expose `GET /health` without authentication for deployment health checks. A healthy service SHALL return HTTP 200 and a response indicating only that the service is available. The response SHALL not include configuration values, environment details, room data, session data, or internal error details.

#### Scenario: Healthy API

Given the API has started successfully
When a client requests `GET /health`
Then the API returns HTTP 200
And the response indicates that the service is available

### Bootstrap API documentation

The system SHALL expose Swagger API documentation containing only the health endpoint during bootstrap. It SHALL not document game commands or unimplemented business endpoints.

#### Scenario: View bootstrap API documentation

Given the API has started successfully
When a client opens the API documentation route
Then the documentation lists the health endpoint
And it lists no business endpoint or game command
