---
title: "Authenticating Your Workflow with OAuth2"
date: 2026-08-17 21:11:00 -0300
tags: [blogging, quarkus-flow, flow, workflow, oauth2, oidc, security]
description: "Learn how OAuth2 works and how to authenticate a Quarkus Flow workflow's HTTP calls with the Client Credentials Flow using the Quarkus Flow OIDC extension"
toc: true
author: Matheus Cruz
image: https://images.unsplash.com/photo-1635602739175-bab409a6e94c?q=80&w=2376&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D
---

## 1. Overview

In mission-critical applications, preventing illegal or unauthorized access to the system is a basic and essential practice. This practice also protects user trust and user credentials, and regulations such as the Brazilian LGPD and the European GDPR reinforce the need for delegated access instead of direct credential sharing. 

In the past, and unfortunately still today (when you delegate all your access to an AI agent 😝), some applications made life easier for end users by simply asking for their credentials, such as username, email, and password.

Consider a system named **FlowPhotos** that lets users share photos with their contacts and offers to sync contacts from Gmail, Yahoo, or other applications. 

In the past, some applications took the user credentials, logged in on the user behalf, and imported all the contacts into **FlowPhotos**. This approach exposes a clear security breach, the third-party application now holds a password for a service it has no business accessing, breaking the trust the user placed in both systems. This is exactly the scenario OAuth was created to solve, delegating access without exposing credentials, and OAuth2 later refined it.

By the end of this tutorial, you will understand:
- What OAuth2 is and why it matters for secure integrations
- How the OAuth2 authorization flow works
- How to authenticate a Quarkus Flow workflow using OAuth2

## 2. What is OAuth2

The OAuth 2.0 specification defines OAuth 2.0 as "the industry-standard protocol for authorization". The word authorization matters here. OAuth 2.0 handles authorization, not authentication, it decides what a client can do on behalf of a user, and it does not verify who the user is.

In the **FlowPhotos** example, OAuth 2.0 lets the user delegate access, the user grants **FlowPhotos** permission to read the Gmail contact list without ever sharing the Gmail password. OAuth 2.0 is fundamentally about consent, and the user stays in control of what a client can access and for how long.

### 2.1 Actors

The OAuth 2.0 specification defines four actors:

- **Resource Owner**: the user who owns the protected data and grants access to it
- **Resource Server**: the API that stores the protected data
- **Client**: the application that requests access to the protected data on behalf of the resource owner
- **Authorization Server**: the system that authenticates the resource owner and issues an access token to the client

Applying these roles to the **FlowPhotos** example, the user is the **Resource Owner**, since the user owns the Gmail contacts. **FlowPhotos** is the **Client**, since it requests access to the contact list. Gmail's API is the **Resource Server**, since it stores the contacts. Google's authorization service is the **Authorization Server**, since it authenticates the user and issues an access token that lets **FlowPhotos** access the **Resource Server** on behalf of the **Resource Owner**.

### 2.2 Clients

The OAuth 2.0 specification classifies a client into two types, based on its ability to keep a client secret confidential:

- **Confidential Client**: an application that runs on a trusted server and can store a client secret securely, such as a backend service or a server-side web application
- **Public Client**: an application that cannot store a client secret securely, such as a single-page application, a mobile app, or a command-line tool, since a user or the browser can extract anything embedded in it

This distinction matters for the next section, which covers the OAuth 2.0 grant types. A public client cannot use a grant type that depends on a client secret, while a confidential client can. 

A [Quarkus Flow workflow](/posts/a-brief-introduction-to-quarkus-flow#6-first-workflow-with-yaml-dsl) that calls an external API on its own, without a specific end user in the loop, typically acts as a confidential client, since it runs on the server and can store its client secret safely.

### 2.3 Flows

The OAuth 2.0 specification defines several grant types, and each one fits a different scenario. This tutorial covers two of them: the **Authorization Code Flow** and the **Client Credentials Flow**.

<!-- TODO: add diagram comparing the Authorization Code Flow and the Client Credentials Flow -->
<!-- ![Authorization Code Flow and Client Credentials Flow](oauth2-flows.png) -->

The **Authorization Code Flow** involves a real user and a browser redirect. This is the flow behind "Sign in with Google" and "Sign in with GitHub", and it also enables **Single Sign-On (SSO)**. With SSO, the user authenticates once with a trusted **Authorization Server**, such as Google or GitHub, and reuses that same session to access multiple applications, instead of creating and remembering a separate password for each one. The flow works as follows:

1. The user clicks "Connect Gmail contacts" in **FlowPhotos**.
2. **FlowPhotos**, the **Client**, redirects the user browser to Google's **Authorization Server**.
3. The user authenticates with Google and consents to let **FlowPhotos** read the contact list. If the user already has an active Google session, Google skips this step and reuses it, which is the essence of SSO.
4. The **Authorization Server** redirects the user browser back to **FlowPhotos** with an authorization code.
5. **FlowPhotos** exchanges the authorization code, together with its client secret, for an access token at Google's token endpoint.
6. **FlowPhotos** calls the Gmail API, the **Resource Server**, with the access token.

Since the **Authorization Server** is the only party that ever sees the user credentials, it can authenticate the same user for any other application that trusts it, without each application handling a password of its own. This centralized authentication is what makes SSO possible, and it is a direct benefit of adopting the Authorization Code Flow.

NOTE: For simplicity I prefer to talk about Authorization Code Flow instead [Authorization Code Flow + PKCE](https://www.rfc-editor.org/info/rfc7636/), The Authorization Code Flow + PKCE is an additional layer of protection to avoid the **authorization code interception attacks**.

The **Client Credentials Flow** is simpler, since it does not involve a user or a browser at all. A **Client** authenticates directly with the **Authorization Server** using its own client ID and client secret, and the **Authorization Server** returns an access token that represents the client itself, not a specific user. The flow works as follows:

1. The **Client** sends its client ID and client secret to the **Authorization Server**.
2. The **Authorization Server** validates the credentials and returns an access token.
3. The **Client** calls the **Resource Server** with the access token.

This flow fits a machine-to-machine scenario, such as a Quarkus Flow workflow that calls an external API on its own, without a specific end user in the loop. The Client Credentials Flow is also the most commonly used grant type for service-to-service authentication, and it is the flow the rest of this tutorial focuses on.

## 3. Prerequisites

Before starting this tutorial, ensure you have:

- **Java 17 or later** installed
- **Maven 3.9+** for dependency management
- **Quarkus CLI** (optional but recommended). See the [installation guide](https://quarkus.io/guides/cli-tooling)
- Basic familiarity with Quarkus Flow. If you are new to it, start with [A brief introduction to Quarkus Flow](/posts/a-brief-introduction-to-quarkus-flow)

**Optional**:
- Docker, so Dev Services can start WireMock automatically while testing

## 4. Setup

Let us create a project with [Quarkus CLI](https://quarkus.io/guides/cli-tooling):

```shell
quarkus create app guru.quarkus:qflow-oauth2 -xrest-jackson
```

This command creates a Quarkus project with the [REST Jackson](https://quarkus.io/guides/rest#what-is-quarkus-rest) extension installed.

Let us add the Quarkus Flow BOM into the `pom.xml` file:

```xml
<dependencyManagement>
    <dependencies>
            <dependency>
                <groupId>io.quarkiverse.flow</groupId>
                <artifactId>quarkus-flow-bom</artifactId>
                <version>1.1.1</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
    </dependencies>
</dependencyManagement>
```

Next, add the `io.quarkiverse.flow:quarkus-flow` and `io.quarkus:quarkus-oidc-client` dependencies:

```xml
<dependency>
    <groupId>io.quarkiverse.flow</groupId>
    <artifactId>quarkus-flow</artifactId>
</dependency>
<dependency>
    <groupId>io.quarkiverse.flow</groupId>
    <artifactId>quarkus-flow-oidc</artifactId>
</dependency>
```

The Open Workflow engine that powers Quarkus Flow already knows how to perform the Client Credentials Flow, and every other OAuth2 or OIDC grant, on its own. Adding `quarkus-flow-oidc` replaces that built-in token acquisition with one backed by Quarkus's own `OidcClient`, which is what the rest of this tutorial relies on. [Section 5.2](#52-understanding-the-authentication-block) explains how this replacement works.

## 5. Securing the HTTP call with the Client Credentials Flow

Back to **FlowPhotos**. Let's imagine that, once a photo is uploaded, the application hands it off to an internal Photo Processing Service that generates thumbnails and extracts metadata. 
That service sits behind Keycloak and only accepts requests carrying a valid access token, so **FlowPhotos** authenticates itself with the Client Credentials Flow described in [section 2.3](#23-flows).

### 5.1. Defining the workflow

Let us create the `processPhotoWorkflow.yaml` file under `src/main/resources/flow`:

```yaml
document:
  dsl: 1.0.0
  namespace: guru-quarkus
  name: processPhotoWorkflow
  version: 0.1.0
do:
  - processPhoto:
      call: http
      with:
        method: post
        body: '$\{ . }'
        endpoint:
          uri: 'https://photos.internal.flowphotos.io/api/photos/\{photoId}/process'
          authentication:
            oauth2:
              authority: https://auth.flowphotos.io/realms/flowphotos
              grant: client_credentials
              client:
                id: '$\{ $secret.photoService.clientId }'
                secret: '$\{ $secret.photoService.clientSecret }'
              endpoints:
                token: /protocol/openid-connect/token
```

### 5.2. Understanding the authentication block

Under `endpoint.authentication`, the `oauth2` key tells Quarkus Flow to negotiate an access token before performing the call:

- `authority`: the base URL of the authorization server, Keycloak in this case
- `grant`: the OAuth2 grant type, `client_credentials` matches the flow from section
- `client.id` and `client.secret`: the credentials **FlowPhotos** uses to authenticate itself, resolved from the `$secret` expressions covered in the next section
- `endpoints.token`: the path of the token endpoint, relative to `authority`. Keycloak exposes it at `/protocol/openid-connect/token` (the default is `/oauth2/token` when this field is omitted).

With `quarkus-flow-oidc` on the classpath, this `oauth2` block is enough to build (or reuse) a Quarkus `OidcClient` from the `authority`, `client`, and `endpoints` values above, request a token from it, and attach the result to the outbound call as an `Authorization: Bearer <token>` header.

This negotiation happens on every call, since Quarkus Flow does not cache the access token itself. Only the underlying `OidcClient` and its HTTP connection pool are cached and reused across calls.

### 5.3. Providing the client secret safely

Notice that the workflow definition never contains the actual client ID or secret. It only references them through `$\{ $secret.photoService.clientId }` and `$\{ $secret.photoService.clientSecret }`. Quarkus Flow resolves these `$secret` expressions against your application configuration, so the real values live in `application.properties`, an environment variable, or a secrets manager wired through MicroProfile Config, never in the workflow file itself:

```properties
photoService.clientId=flowphotos-worker
photoService.clientSecret=super-secret-value
```

Because this workflow has no runtime expressions in its `authentication` block beyond the secret lookup, Quarkus Flow can resolve it at build time and generate the equivalent `quarkus.oidc-client.*` configuration for you, so the `OidcClient` is ready before the application even starts.

### 5.4. Java DSL equivalent with configurable endpoints

The YAML version above is easy to read, but its `endpoint.uri` and `authority` are fixed strings, which makes it awkward to point at a different Photo Processing Service instance in tests. The Java DSL solves this the same way any other Quarkus bean would, through configuration injection:

```java
package guru.quarkus;

import io.quarkiverse.flow.Flow;
import io.quarkiverse.flow.dsl.FlowWorkflowBuilder;
import io.serverlessworkflow.api.types.Workflow;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import static io.quarkiverse.flow.dsl.FlowDSL.http;
import static io.quarkiverse.flow.dsl.FlowDSL.oauth2;
import static io.serverlessworkflow.api.types.OAuth2AuthenticationData.OAuth2AuthenticationDataGrant.CLIENT_CREDENTIALS;

@ApplicationScoped
public class ProcessPhotoFlow extends Flow {

    @ConfigProperty(name = "photoService.authority")
    String authority;

    @ConfigProperty(name = "photoService.baseUrl")
    String baseUrl;

    @Override
    public Workflow descriptor() {
        return FlowWorkflowBuilder.workflow("processPhotoWorkflow", "guru-quarkus")
                .use(u -> u.secrets("photoService"))
                .tasks(
                        http("processPhoto")
                                .post()
                                .body("$\{ . }")
                                .endpoint(baseUrl + "/api/photos/photoId/process",
                                        oauth2(authority, CLIENT_CREDENTIALS,
                                                "${ $secret.photoService.clientId }",
                                                "${ $secret.photoService.clientSecret }",
                                                e -> e.token("/protocol/openid-connect/token")))
                ).build();
    }
}
```

The `oauth2(...)` overload from `FlowDSL` mirrors the YAML block field for field: authority, grant, client ID, client secret, and a callback to customize the token endpoint path. Injecting `authority` and `baseUrl` through `@ConfigProperty` is what lets us point this same workflow at Keycloak and the Photo Processing Service in production, and at a local WireMock server in tests, purely through configuration, which is exactly what we need in [section 6](#6-testing-the-workflow).

Let us also add the REST endpoint that starts this workflow:

```java
package guru.quarkus;

import io.serverlessworkflow.impl.WorkflowModel;
import jakarta.inject.Inject;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.core.Response;

import java.util.Map;

@Path("/photos")
public class PhotoResource {

    @Inject
    ProcessPhotoFlow processPhotoFlow;

    @POST
    @Path("/\{photoId}/process")
    public Response process(@PathParam("photoId") String photoId) {
        WorkflowModel output = processPhotoFlow.instance(Map.of("photoId", photoId)).start().join();
        return Response.ok(output.asJavaObject()).build();
    }
}
```

### 5.5. Reusing a named authentication across tasks

Let's think that **FlowPhotos** also notifies a Notifications API once processing finishes, and that service sits behind the same Keycloak realm. Declaring the same `oauth2` block on every task would duplicate the client ID, secret, and token endpoint path across the workflow. Instead, we can declare the policy once, under `use.authentications`, and reference it by name:

```yaml
document:
  dsl: 1.0.0
  namespace: guru.quarkus
  name: processPhotoWorkflow
  version: 0.1.0
use:
  authentications:
    flowPhotosAuth:
      oauth2:
        authority: https://auth.flowphotos.io/realms/flowphotos
        grant: client_credentials
        client:
          id: '$\{ $secret.photoService.clientId }'
          secret: '$\{ $secret.photoService.clientSecret }'
        endpoints:
          token: /protocol/openid-connect/token
do:
  - processPhoto:
      call: http
      with:
        method: post
        body: '$\{ . }'
        endpoint:
          uri: 'https://photos.internal.flowphotos.io/api/photos/\{photoId}/process'
          authentication:
            use: flowPhotosAuth
  - notifyPhotoProcessed:
      call: http
      with:
        method: post
        body: '$\{ . }'
        endpoint:
          uri: https://notifications.internal.flowphotos.io/api/notifications
          authentication:
            use: flowPhotosAuth
```

Both tasks now resolve the same named policy, so Quarkus Flow builds a single `OidcClient` for it and reuses it for every call that references `flowPhotosAuth`, instead of creating one per task.

### 5.6. OAuth2 versus OIDC discovery

Everything so far used the `oauth2` key, which requires you to specify the token endpoint path explicitly, since it disables OIDC discovery. Keycloak, like most modern identity providers, also exposes a standard OpenID Connect discovery document at `/.well-known/openid-configuration`. When your authorization server supports it, the `oidc` key lets Quarkus Flow discover the token endpoint on its own, so you can drop `endpoints` entirely:

```yaml
authentication:
  oidc:
    authority: https://auth.flowphotos.io/realms/flowphotos
    grant: client_credentials
    client:
      id: '$\{ $secret.photoService.clientId }'
      secret: '$\{ $secret.photoService.clientSecret }'
```

Use `oidc` whenever the authorization server supports discovery and you want one less path to keep in sync if it ever changes. Use `oauth2` when you need to point at a specific token endpoint, such as a provider without discovery support or a non-default path. Quarkus Flow treats the two as distinct policies internally, since `oidc` builds its `OidcClient` with discovery enabled and `oauth2` builds it with discovery disabled and an explicit token path, so switching between them for the same authority still results in two separately cached clients.

### 5.7. Routing to a specific named OIDC client

Section 5.5 introduced `flowPhotosAuth` as a named authentication policy, and both `processPhoto` and `notifyPhotoProcessed` still describe the client ID, and the client secret directly inside the workflow file. 
Promoting the workflow from a development environment to a production one, would mean editing that block and redeploying the workflow itself.

Quarkus Flow avoids this by letting `application.properties` route an authentication policy to a Quarkus OidcClient that already exists, instead of building one from the workflow's own `oauth2` or `oidc` declaration. Declare the target client with the standard `quarkus.oidc-client.<name>.*` properties, then point the policy at it:

```properties
%dev.quarkus.flow.oidc.client.flowPhotosAuth.name=flowPhotos-dev
%prod.quarkus.flow.oidc.client.flowPhotosAuth.name=flowPhotos-prod

quarkus.oidc-client.flowPhotos-dev.auth-server-url=http://localhost:8180/realms/flowphotos
quarkus.oidc-client.flowPhotos-dev.client-id=flowphotos-worker
quarkus.oidc-client.flowPhotos-dev.credentials.secret=dev-secret

quarkus.oidc-client.flowPhotos-prod.auth-server-url=https://auth.flowphotos.io/realms/flowphotos
quarkus.oidc-client.flowPhotos-prod.client-id=flowphotos-worker
quarkus.oidc-client.flowPhotos-prod.credentials.secret=$\{PHOTO_SERVICE_CLIENT_SECRET}
```

`flowPhotos-dev` and `flowPhotos-prod` are regular Quarkus OIDC clients, configured exactly as described in the [Quarkus OIDC Client documentation](https://quarkus.io/guides/security-oidc-client-reference). Quarkus Flow no longer builds its own client for `flowPhotosAuth` in either profile, it looks up the client that matches the active profile and reuses it for both `processPhoto` and `notifyPhotoProcessed`. 
The workflow file from section 5.5 stays untouched, since routing is entirely a configuration concern.

Because this override lives in `application.properties` rather than in the workflow, it also works for the plain YAML workflow from section 5.1, whose `endpoint.uri` and `authority` are hardcoded strings. There is no need to introduce `$secret` lookups or `@ConfigProperty` fields just to swap the client per environment.

The key on the left of `quarkus.flow.oidc.client.<key>.name` does not have to be a named policy. Quarkus Flow resolves it from most specific to least specific:

1. A single task: `<namespace>\:<name>\:<version>.task.<taskName>`
2. A specific workflow version: `<namespace>\:<name>\:<version>`
3. Any version of a workflow: `<namespace>\:<name>`
4. A named authentication policy, such as `flowPhotosAuth`

For example, routing only `processPhoto` to a specific client, without touching `notifyPhotoProcessed` or the `flowPhotosAuth` policy itself, looks like this:

```properties
quarkus.flow.oidc.client."guru.quarkus\:processPhotoWorkflow\:0.1.0.task.processPhoto".name=namedFlowPhotos
```

NOTE: The quotes and the escaped colons, the composite key mixes namespace, workflow name, and version, and each colon must be escaped as `\:` inside the property key. 

Quarkus Flow tries every level from the most specific match down to the named policy, and stops at the first one it finds, so a single task override like this one takes precedence over the `flowPhotosAuth` routing declared for the rest of the workflow.

This routing mechanism reuses the same dual lookup Quarkus Flow already applies to caching, by name for named policies and routing overrides, and by endpoint configuration for calls that share identical OAuth2 settings. Two calls share a cached `OidcClient` only when the authority, token endpoint, client credentials, grant type, scopes, and discovery flag all match exactly, so routing two tasks to different named clients, as done above, always results in separate `OidcClient` instances.

## 6. Testing the workflow

We prefer to mock the Photo Processing Service and Keycloak with a local [WireMock](https://wiremock.org/) server, since it keeps the test focused on the token negotiation itself. The `io.quarkiverse.wiremock:quarkus-wiremock` extension lets Dev Services start and stop this WireMock server automatically:

```xml
<dependency>
    <groupId>io.quarkiverse.wiremock</groupId>
    <artifactId>quarkus-wiremock</artifactId>
    <version>1.7.0</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>io.quarkiverse.wiremock</groupId>
    <artifactId>quarkus-wiremock-test</artifactId>
    <version>1.7.0</version>
    <scope>test</scope>
</dependency>
```

Let us point `photoService.authority` and `photoService.baseUrl` at the WireMock instance only when running tests, using the `%test` profile:

```properties
%test.photoService.authority=http://localhost:$\{quarkus.wiremock.devservices.port}
%test.photoService.baseUrl=http://localhost:$\{quarkus.wiremock.devservices.port}
```

With both the token endpoint and the downstream API now resolving to the same WireMock server, we can stub both and assert that the outbound call carries a valid bearer token:

```java
package guru.quarkus;

import com.github.tomakehurst.wiremock.client.WireMock;
import io.quarkiverse.wiremock.devservice.ConnectWireMock;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.okJson;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static io.restassured.RestAssured.given;

@QuarkusTest
@ConnectWireMock
class ProcessPhotoFlowTest {

    WireMock wireMock;

    @Test
    void processesPhotoWithBearerToken() {
        wireMock.register(post(urlEqualTo("/protocol/openid-connect/token"))
                .willReturn(okJson("""
                        {
                          "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30",
                          "token_type": "Bearer",
                          "expires_in": 300
                        }
                        """)));

        wireMock.register(post(urlPathMatching("/api/photos/.*"))
                .withHeader("Authorization", equalTo("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30"))
                .willReturn(okJson("{\"status\": \"processed\"}")));

        given()
                .when()
                .post("/photos/42/process")
                .then()
                .statusCode(200)
                .body("status", org.hamcrest.Matchers.equalTo("processed"));

        wireMock.verify(postRequestedFor(urlPathMatching("/api/photos/.*"))
                .withHeader("Authorization", equalTo("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30")));
    }
}
```

Let us break down what this test verifies:

1. The first `register(post(...))` plays the role of Keycloak's token endpoint, returning a fixed access token whenever the workflow requests one.
2. The second `register(post(...))` plays the role of the Photo Processing Service. WireMock only answers with `200 OK` when the request carries the exact `Authorization: Bearer ...` header, so a missing or malformed token makes this stub return WireMock's default `404`, which fails the test.
3. `verify(postRequestedFor(...))` asserts, after the fact, that the call reached WireMock with that same header, which confirms the token round trip actually happened rather than being skipped.

If you run `./mvnw test`, Dev Services starts WireMock, resolves `$\{quarkus.wiremock.devservices.port}`, and the test exercises the full negotiation, from requesting a token to attaching it to the outbound call, without touching a real Keycloak instance.

## 7. Best Practices

**Never hardcode client credentials:** Reference them through `$secret` expressions, as we did with `photoService.clientId` and `photoService.clientSecret`, and keep the real values out of the workflow file and out of version control.

**Prefer `oidc` when discovery is available:** Letting Quarkus Flow discover the token endpoint from the authority, as shown in [section 5.6](#56-oauth2-versus-oidc-discovery), removes one more path you would otherwise have to keep in sync if the authorization server changes it.

**Reuse named authentications:** When several tasks call services behind the same authorization server, declare the policy once under `use.authentications` and reference it by name, as we did with `flowPhotosAuth`. This avoids duplicating credentials across the workflow and lets Quarkus Flow cache a single `OidcClient` for all of them.

**Route clients per environment instead of duplicating URLs:** Use `quarkus.flow.oidc.client.<key>.name`, as shown in [section 5.7](#57-routing-to-a-specific-named-oidc-client), to point a named authentication policy, or even a single task, at a different pre-configured `OidcClient` per profile. This keeps the workflow itself environment-agnostic and centralizes credential management in `application.properties`.

**Do not assume the access token is cached:** Quarkus Flow requests a fresh token on every authenticated call, 
only the underlying `OidcClient` and its connection pool are cached and reused. 
If your authorization server is slow to respond, tune `quarkus.flow.oidc.creation-timeout` and `quarkus.flow.oidc.connection-timeout` instead of assuming a stale token is being reused.

## 8. Conclusion

In this tutorial, we explored how to authenticate a Quarkus Flow workflow's HTTP calls with OAuth2, covering:

- What OAuth2 is, why it protects user credentials and trust, and how it differs from authentication
- The Authorization Code Flow, the flow behind "Sign in with Google" and SSO, and the Client Credentials Flow used for service-to-service calls
- Declaring an inline `oauth2` authentication policy on an HTTP call task, in both YAML and Java DSL
- Reusing a named authentication policy across multiple tasks
- The difference between `oauth2` and `oidc`, and when to prefer discovery
- Routing a named authentication policy, or a single task, to a pre-configured Quarkus OIDC client with `quarkus.flow.oidc.client.<key>.name`
- Testing the full token negotiation with WireMock standing in for the authorization server and the downstream API

Delegated access through OAuth2 keeps **FlowPhotos**, and the services it depends on, from ever handling a password that is not theirs, while the Client Credentials Flow gives a Quarkus Flow workflow a safe, standard way to authenticate itself when no end user is involved.

### 8.1. Next Steps

To deepen your understanding, consider:

- Adding the Authorization Code Flow to let a real user connect their Gmail or GitHub contacts to **FlowPhotos**
- Combining OAuth2 authentication with the [HTTP retry and timeout configuration](/posts/a-brief-introduction-to-quarkus-flow#8-error-handling) from the introductory tutorial, so a slow authorization server does not hang the whole workflow

### 8.2. Further Reading

- [The OAuth 2.0 Authorization Framework (RFC 6749)](https://datatracker.ietf.org/doc/html/rfc6749)
- [OAuth 2.0 and PKCE](https://oauth.net/2/pkce/)
- [Quarkus OIDC Client documentation](https://quarkus.io/guides/security-oidc-client-reference)
- [Quarkus Flow Documentation](https://docs.quarkiverse.io/quarkus-flow/dev/index.html)
- [A brief introduction to Quarkus Flow](/posts/a-brief-introduction-to-quarkus-flow)