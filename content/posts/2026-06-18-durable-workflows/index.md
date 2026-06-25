---
title: "Durable Workflows with Quarkus Flow"
date: 2026-06-18 16:15:00 +0000
tags: [blogging, quarkus-flow, flow, workflow, durable-workflows, persistence]
description: "Make long-running and Human-In-The-Loop workflows durable with the Quarkus Flow Persistence extension, so they survive crashes and restarts and resume from the last checkpoint"
toc: true
author: Matheus Cruz
image: https://images.unsplash.com/photo-1524473816810-458fcfb9b1fa?q=80&w=1251&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D
---

## 1. Overview

In the [previous post about Quarkus Flow](/posts/a-brief-introduction-to-quarkus-flow), we saw how to orchestrate complex business processes with both the YAML and Java DSLs. But some processes outlive the application that runs them: **long-running** and **Human-In-The-Loop (HITL)** workflows. 

This is even more common in modern applications, where workflows increasingly orchestrate **LLM calls**, which are both slow and expensive, so losing their progress to a restart wastes real time and money.

These workflows can live for minutes, hours, or even months before they complete. A real application, however, does not stay up forever: deployments, crashes, and scale-down events all interrupt running work. 

The **Quarkus Flow Persistence** extension solves this by durably storing workflow state, so an instance can be paused, survive a shutdown, and resume exactly where it left off.

In this tutorial, we will explore how durable workflows work in Quarkus Flow and how to persist and recover long-running instances across application restarts.

By the end of this tutorial, you will understand:

- What durable workflows are and why long-running, HITL, and LLM-driven processes need them
- How to add and configure the Quarkus Flow Persistence extension
- How workflow state is persisted and recovered after a restart
- How to pause a workflow and resume it from a human or external event
- Best practices for running durable workflows in production

## 2. TL;DR

Long-running and HITL workflows can outlive your application's uptime. The Quarkus Flow Persistence extension durably stores workflow state so instances survive restarts and resume where they stopped. See the [Quarkus Flow documentation](https://docs.quarkiverse.io/quarkus-flow/dev/index.html) for the full reference.

## 3. Prerequisites

Before starting this tutorial, ensure you have:

- **Java 17 or later** installed
- **Maven 3.9+** for dependency management
- **Quarkus CLI** (optional but recommended). See the [installation guide](https://quarkus.io/guides/cli-tooling)
- Basic familiarity with Quarkus Flow. If you are new to it, start with [A brief introduction to Quarkus Flow](/posts/a-brief-introduction-to-quarkus-flow)

**Optional**:
- Docker for running a database via Dev Services

## 4. Setup

Let us create a project with [Quarkus CLI](https://quarkus.io/guides/cli-tooling):

```shell
quarkus create app guru.quarkus:qflow-durable -xrest-jackson
```

This command creates a Quarkus project with the [REST Jackson](https://quarkus.io/guides/rest#what-is-quarkus-rest) extension installed.

If you prefer, you can use [Code QuarkusIO](https://code.quarkus.io) to generate a Quarkus project with a visual interface.

Next, add the `io.quarkiverse.flow:quarkus-flow` and `io.quarkiverse.flow:quarkus-flow-redis` dependencies into the `pom.xml` file:

```xml
<dependency>
    <groupId>io.quarkiverse.flow</groupId>
    <artifactId>quarkus-flow</artifactId>
    <version>0.10.2</version>
</dependency>
<dependency>
    <groupId>io.quarkiverse.flow</groupId>
    <artifactId>quarkus-flow-redis</artifactId>
    <version>0.10.2</version>
</dependency>
```

**NOTE:** At this moment, the current Quarkus Flow version is 0.10.2!

The `quarkus-flow-redis` extension stores workflow checkpoints in Redis. In dev and test mode, Quarkus [Dev Services](https://quarkus.io/guides/redis-dev-services) automatically starts a Redis container for you, so you can follow along without any extra configuration.

## 5. Creating the application (vacation management)

Now, let us create a Quarkus Flow workflow to handle a simple vacation request, which requires approval from a manager.

### 5.1. Creating the vacation store

Let us store the vacation requests in Redis (the same Redis that backs our workflow checkpoints), using three hashes: one for pending **requests**, one for **approved**, and one for **rejected**.

```java
package guru.quarkus;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import guru.quarkus.RequestVacationFlow.VacationRequest;
import io.quarkus.redis.datasource.RedisDataSource;
import io.quarkus.redis.datasource.hash.HashCommands;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Collection;
import java.util.List;

@ApplicationScoped
public class VacationStore {

    static final String REQUESTS = "vacations:requests";
    static final String APPROVED = "vacations:approved";
    static final String REJECTED = "vacations:rejected";

    private final HashCommands<String, String, String> hash;
    private final ObjectMapper mapper;

    public VacationStore(RedisDataSource ds, ObjectMapper mapper) {
        this.hash = ds.hash(String.class);
        this.mapper = mapper;
    }

    public void addRequest(VacationRequest request) {
        hash.hsetnx(REQUESTS, request.employeeId(), write(request));
    }

    public Collection<VacationRequest> pendingRequests() {
        return read(hash.hgetall(REQUESTS).values());
    }

    public void review(String employeeId, boolean approved) {
        String json = hash.hget(REQUESTS, employeeId);
        if (json == null) {
            return;
        }
        hash.hdel(REQUESTS, employeeId);
        hash.hset(approved ? APPROVED : REJECTED, employeeId, json);
    }

    public Collection<VacationRequest> approved() {
        return read(hash.hgetall(APPROVED).values());
    }

    public Collection<VacationRequest> rejected() {
        return read(hash.hgetall(REJECTED).values());
    }

    private String write(VacationRequest request) {
        try {
            return mapper.writeValueAsString(request);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialize vacation request", e);
        }
    }

    private List<VacationRequest> read(Collection<String> values) {
        return values.stream().map(json -> {
            try {
                return mapper.readValue(json, VacationRequest.class);
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Could not deserialize vacation request", e);
            }
        }).toList();
    }
}
```

The store uses the type-safe [Redis Data Source](https://quarkus.io/guides/redis-reference) `HashCommands` API. A few details worth highlighting:

- `addRequest` uses `hsetnx` (set-if-not-exists), so re-running the task after a recovery never overwrites an existing request.
- `review` moves a request from the pending hash into the approved or rejected one.
- Requests are serialized to JSON with Jackson before being stored as hash fields.

### 5.2. Creating a workflow with Java DSL

Let us create the workflow responsible for manipulating the data and controlling the application flow.

```java
package guru.quarkus;

import io.quarkiverse.flow.Flow;
import io.serverlessworkflow.api.types.Workflow;
import io.serverlessworkflow.fluent.func.FuncWorkflowBuilder;
import io.serverlessworkflow.fluent.func.dsl.FuncDSL;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

import java.time.LocalDate;

@ApplicationScoped
public class RequestVacationFlow extends Flow {

    @Inject
    VacationStore store;

    @Override
    public Workflow descriptor() {
        return FuncWorkflowBuilder
                .workflow("approve-vacation", "guru.quarkus", "0.1.0")
                .tasks(
                        FuncDSL.function("persistVacationRequest", request -> {
                            store.addRequest(request);
                            return request;
                        }, VacationRequest.class),
                        FuncDSL.listen("waitByManagerReview", FuncDSL.toOne("guru.quarkus.vacation.reviewed")),
                        FuncDSL.function("handleManagerReview", event -> {
                            store.review(event.employeeId(), event.approved());
                            return event;
                        }, VacationRequestReviewedEvent.class)
                )
                .build();
    }

    public record VacationRequestReviewedEvent(String employeeId, boolean approved) {}
    public record VacationRequest(String employeeId, LocalDate from, LocalDate to) {}
}
```

Let us break down this implementation:

The workflow `guru.quarkus:approve-vacation:0.1.0` contains three tasks:

1. `persistVacationRequest` saves the incoming vacation request through the `VacationStore`.
2. `waitByManagerReview` is a `listen` task that waits for a [`CloudEvent`](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md) carrying the manager's decision (`VacationRequestReviewedEvent`).
3. `handleManagerReview` processes the `VacationRequestReviewedEvent` and asks the store to move the request into the approved or rejected hash, depending on the manager's decision.

### 5.3. Creating the JAX-RS resource

Now, to finish our example, let us create a JAX-RS resource that starts the workflow and uses the `VacationStore` to expose the current state.

```java
package guru.quarkus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.cloudevents.core.v1.CloudEventBuilder;
import io.cloudevents.jackson.JsonCloudEventData;
import io.serverlessworkflow.impl.WorkflowApplication;
import io.serverlessworkflow.impl.WorkflowInstance;
import io.serverlessworkflow.impl.events.EventPublisher;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.Response;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Path("/vacations")
public class VacationResource {

    @Inject
    RequestVacationFlow flow;

    @Inject
    WorkflowApplication workflow;

    @Inject
    ObjectMapper mapper;

    @Inject
    VacationStore store;

    @POST
    public Response request(RequestVacationFlow.VacationRequest vacationRequest) {
        WorkflowInstance instance = flow.instance(vacationRequest);
        String id = instance.id();
        instance.start(); // runs async
        return Response.status(Response.Status.ACCEPTED)
                .header("Flow-Id", id)
                .build();
    }

    @GET
    @Path("/requests")
    public Response allRequests() {
        return Response.ok(store.pendingRequests()).build();
    }

    @GET
    @Path("/all")
    public Response all() {
        return Response.ok(Map.of(
                "approved", store.approved(),
                "rejected", store.rejected()
        )).build();
    }

    @POST
    @Path("/reviews")
    public Response review(RequestVacationFlow.VacationRequestReviewedEvent event) {
        EventPublisher pub = workflow.eventPublishers().stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("No workflow event publishers!"));
        JsonNode jsonNode = mapper.convertValue(event, JsonNode.class);
        pub.publish(new CloudEventBuilder()
                .withType("guru.quarkus.vacation.reviewed")
                .withId(UUID.randomUUID().toString())
                .withTime(OffsetDateTime.now())
                .withSource(URI.create("https://quarkus.guru"))
                .withData(JsonCloudEventData.wrap(jsonNode))
                .build());
        return Response.status(Response.Status.OK).build();
    }
}
```

This is a simple JAX-RS resource that starts the `RequestVacationFlow` and uses the `VacationStore` to expose the current state. A few details worth highlighting:

- **Starting the workflow asynchronously:** `flow.instance(vacationRequest)` creates the instance and `instance.start()` launches it without blocking, so there is no need to wait on a long-running process.
- **Sending an event to a running workflow:** To wake up the paused `waitByManagerReview` task, we publish a `CloudEvent` through the `WorkflowApplication#eventPublishers()` API. We take the first `EventPublisher`, build a `CloudEvent` whose `type` matches the one the `listen` task waits for (`guru.quarkus.vacation.reviewed`), and call `publish`.

**NOTE:** Building and publishing CloudEvents by hand is fine for a small example. For real applications, the [Quarkus Flow messaging](https://docs.quarkiverse.io/quarkus-flow/dev/messaging.html) integration lets you emit and consume workflow events through Quarkus Reactive Messaging, connecting workflows to channels and brokers (Kafka, AMQP, and so on) instead of wiring publishers by hand.

## 6. Executing the workflow and recovering from a crash

If you run the application in dev mode (via `quarkus dev` or `mvn quarkus:dev`) and make an HTTP request to start the workflow:

```shell
curl 'http://localhost:8080/vacations' \
  -H 'Content-Type: application/json' \
  --data-raw '{"employeeId":"1","from":"2026-07-01","to":"2026-07-08"}'
```

You will see something like this in the logs:

```shell
Workflow name=approve-vacation instanceId=01KVXFT4841RF4PQQX1H9PW8HQ started at 2026-06-24T16:02:20.761512-03:00 input={"employeeId":"1","from":"2026-07-01","to":"2026-07-08"}
Task 'persistVacationRequest' started at 2026-06-24T16:02:20.768755-03:00 pos=do/0/persistVacationRequest
Task 'persistVacationRequest' completed at 2026-06-24T16:02:20.769362-03:00 output={"employeeId":"1","from":"2026-07-01","to":"2026-07-08"}
Task 'waitByManagerReview' started at 2026-06-24T16:02:20.776684-03:00 pos=do/1/waitByManagerReview
```

The workflow is now waiting for the CloudEvent of type `guru.quarkus.vacation.reviewed`. So what happens if you force-restart the application from your terminal (by pressing `s`)? A force-restart simulates a crash followed by a fresh start of the application. After doing it, you will see something like this in the logs:

```shell
Flow: WorkflowApplication is ready. Starting workflow definitions warmup.
Warming up 1 WorkflowDefinition beans
Flow: Workflow definitions warmup complete.
Task 'waitByManagerReview' started at 2026-06-24T16:05:07.885307-03:00 pos=do/1/waitByManagerReview
```

Great! As you can see in the logs, the task `waitByManagerReview` started again; we did not lose our running workflow. After the restart, if we call the `POST /vacations/reviews` endpoint with a proper body, the workflow continues executing as if nothing had happened:

```shell
curl 'http://localhost:8080/vacations/reviews' \
  -H 'Content-Type: application/json' \
  --data-raw '{"employeeId":"1","approved":true}'
```

Now you can see the approved vacation:

```shell
curl 'http://localhost:8080/vacations/all'
```

The HTTP response should look something like this:

```json
{
    "approved": [
        {
            "employeeId": "1",
            "from": "2026-07-01",
            "to": "2026-07-08"
        }
    ],
    "rejected": []
}
```

## 7. How Quarkus Flow Persistence works

### 7.1. Writing

Every time a task completes or pauses, Quarkus Flow writes the current state of the workflow instance to the datastore. This snapshot is called a **checkpoint**: it captures where the instance is in the workflow and the data it carries, so execution can be resumed from that exact point later.

Each checkpoint is stored under a key built from the application id (`quarkus.application.name`) together with the workflow's coordinates: its namespace, name, and version.

So a checkpoint is not just associated with an application; it is scoped to a specific workflow definition within that application. As we will see in the next section, this composite key is exactly what Quarkus Flow uses to find the right instances again after a restart.

### 7.2. Restoring

When the application boots, each workflow definition scans the datastore for the instances that belong to it, matching on the application id (`quarkus.application.name`) and the workflow's *namespace*, *name*, and *version*, then resumes each one from its last checkpoint.

The match is exact on every part. An application named `xpto` (`quarkus.application.name=xpto`) only restores checkpoints written by `xpto`, and only for a workflow definition it still declares with the same `namespace`, `name`, and `version`. This is also why versioning matters. An in-flight instance is picked up by the definition that started it, not by a newer version.

**NOTE**: Restoration only resumes tasks that were paused or running. Tasks that had already failed are not restored.

Automatic restoration is enabled by default. You can turn it off in `application.properties`:

```properties
quarkus.flow.persistence.autoRestore=false
```

This name-based identity has one important consequence. If you run several replicas that share the same `quarkus.application.name`, every replica will try to restore the same checkpoints at startup, competing for the same instances. This is exactly the problem the Kubernetes integration solves with lease-based coordination, which we cover in [section 9](#9-durable-workflows-in-kubernetes).

## 8. Available datastores

In this example, we used the **Quarkus Flow Redis** extension (`quarkus-flow-redis`) to store the workflow's checkpoints on a Redis server. But it is not the only option:

- **JPA / relational databases** (`quarkus-flow-jpa`): checkpoints into any SQL database supported by Quarkus (PostgreSQL, MySQL, H2, Oracle, MSSQL). A good option if you already have a relational database in your stack.
- **MVStore** (`quarkus-flow-mvstore`): a lightweight, file-based store ideal for development, testing, and single-node deployments. Just point it at a file:

  ```properties
  quarkus.flow.persistence.mvstore.db-path=$\{user.home}/flow.db
  ```

**NOTE**: Include only **one** persistence provider per project.

## 9. Durable Workflows in Kubernetes

So far we have recovered a workflow on a single machine by simply restarting the process. In production, though, you most likely run on [Kubernetes](https://kubernetes.io/), and that changes the rules: pods are ephemeral. Their names and IPs come and go with every rolling update, node drain, or autoscaling event.

Recall from [section 7](#7-how-quarkus-flow-persistence-works) that every checkpoint is keyed by the application id (`quarkus.application.name`), and that on startup an application restores exactly the checkpoints written under its own id. That identity is the whole game in Kubernetes, and it can break in two ways:

- **Unstable identity → orphaned checkpoints.** If the application id were derived from something ephemeral like the pod name, every restart would produce a *new* id. The checkpoints written by the old pod would then belong to an id that no running pod ever scans for, so they would sit in the datastore, persisted but never resumed.
- **Shared identity → competing replicas.** If instead every replica boots with the *same* `quarkus.application.name`, they all scan for the same checkpoints at startup and race to restore the same instances, exactly the problem we flagged at the end of section 7.

The `quarkus-flow-durable-kubernetes` extension solves both with **Lease-based coordination**. Instead of binding the worker identity to an ephemeral pod or sharing a single id across replicas, it gives each pod a stable, distinct identity drawn from a pool of [Kubernetes Leases](https://kubernetes.io/docs/concepts/architecture/leases/):

1. **Lease assignment**: each pod acquires a stable lease from the pool (for example, `flow-pool-member-durable-flow-00`) that becomes its persistence identity and outlives the pod itself.
2. **Heartbeat renewal**: the pod continuously renews its lease to keep ownership.
3. **Seamless failover**: when a pod crashes, its lease expires; a replacement pod claims the same lease, inherits the same identity, and therefore restores exactly the checkpoints the crashed pod left behind.

### 9.1. Adding the extension

Add the `io.quarkiverse.flow:quarkus-flow-durable-kubernetes` dependency to the `pom.xml` file:

```xml
<dependency>
    <groupId>io.quarkiverse.flow</groupId>
    <artifactId>quarkus-flow-durable-kubernetes</artifactId>
    <version>0.10.2</version>
</dependency>
```

### 9.2. Configuration

Configure the lease pool and gate readiness on lease acquisition in `application.properties`:

```properties
# The name of the Lease pool used to generate Lease resources
quarkus.flow.durable.kube.pool.name=durable-flow

# A pod is only "ready" once it has acquired a Lease
quarkus.flow.durable.kube.health.readiness.require-lease=true
```

The `require-lease` setting is important: if a pod has not acquired a lease, it has no identity, so it should not receive traffic or pull workflows from the datastore. Wiring this into the readiness probe ensures Kubernetes only routes work to pods that can actually own it.

The extension also needs to know its own pod identity, which is exposed through the [Downward API](https://kubernetes.io/docs/concepts/workloads/pods/downward-api/):

```yaml
env:
  - name: POD_NAME
    valueFrom:
      fieldRef:
        fieldPath: metadata.name
  - name: POD_NAMESPACE
    valueFrom:
      fieldRef:
        fieldPath: metadata.namespace
```

Finally, the pod needs RBAC permissions to manage leases. Using the Quarkus Kubernetes extension, you can generate the `ServiceAccount` and `Role` directly from configuration:

```properties
quarkus.kubernetes.rbac.service-accounts.durable-flow-sa.use-as-default=true
quarkus.kubernetes.rbac.roles.durable-flow-sa.policy-rules.0.api-groups=coordination.k8s.io
quarkus.kubernetes.rbac.roles.durable-flow-sa.policy-rules.0.resources=leases
quarkus.kubernetes.rbac.roles.durable-flow-sa.policy-rules.0.verbs=get,list,watch,create,update,patch,delete
```

### 9.3. Deployment strategy

The deployment strategy must give pods a chance to release their leases before replacements start; otherwise a new pod could deadlock waiting for a lease that the old one still holds.

For a **single replica**, use the `Recreate` strategy so the old pod is fully terminated before the new one starts:

```yaml
spec:
  replicas: 1
  strategy:
    type: Recreate
```

For **multiple replicas**, use a `RollingUpdate` that replaces only one pod at a time:

```yaml
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
```

With this in place, a rolling update or a crashed node no longer orphans your workflows: the lease moves to a healthy pod and execution continues from the last checkpoint, exactly like the crash recovery we saw in dev mode, but now resilient to the realities of a Kubernetes cluster.

For the full reference, see the [Durable Workflows in Kubernetes](https://docs.quarkiverse.io/quarkus-flow/dev/concepts-durable-workflow-k8s.html) documentation.

## 10. Best Practices

**Use durable workflows when state must outlive the process:** Long-running and HITL workflows that wait for events, approvals, or webhooks need persistence. Workflows that complete within a single request gain nothing from checkpointing, so you can keep them entirely in-memory by excluding them with their `namespace:name:version` identifier:

```properties
quarkus.flow.persistence.exclude-workflows=guru.quarkus:approve-vacation:0.1.0
```

**Make task side effects idempotent:** After a crash, a running task may execute again from the last checkpoint, and a `listen` task may receive the same event more than once. 
Tasks should therefore be safe to repeat. 
Notice that our `VacationStore.addRequest` uses Redis `hsetnx` (set-if-not-exists), so replaying `persistVacationRequest` never creates a duplicate request.

**Pick the store that matches your topology:** Use MVStore for local development, and Redis or JPA for distributed, multi-replica production workloads. Remember to include only one provider per project, and manage the JPA schema with Flyway in production.

**Version your workflows:** We pinned `approve-vacation` to `0.1.0` (by default is `0.1.0`). 
An in-flight instance keeps resolving the definition it started with, 
so versioning lets you evolve a workflow without breaking work that is already running.

**On Kubernetes, gate readiness on the lease and choose the right rollout:** 
Set `quarkus.flow.durable.kube.health.readiness.require-lease=true` and use `Recreate` (single replica) or `RollingUpdate` with `maxUnavailable: 1` so leases are released before replacements start.

## 11. Conclusion

In this tutorial, we explored durable workflows with Quarkus Flow, covering:

- Why long-running and HITL workflows need durable state
- Adding the Quarkus Flow Redis persistence extension and configuring it
- Building a vacation-approval workflow that pauses on a `listen` task waiting for a `CloudEvent`
- Recovering an in-flight workflow after a simulated crash in dev mode
- How checkpointing works, the available datastores (Redis, JPA, MVStore), and how to survive pod disruptions on Kubernetes with lease-based coordination
- Best practices for running durable workflows in production

Persistence turns Quarkus Flow from an in-memory orchestrator into a durable engine that can carry a workflow across restarts, crashes, and weeks of waiting for a human, while keeping the same simple programming model.

### 11.1. Next Steps

To deepen your understanding, consider:

- Switching the example to the [JPA store and managing its schema with Flyway](https://docs.quarkiverse.io/quarkus-flow/dev/persistence.html#_option_b_jpa_relational_databases)
- Deploying the workflow to Kubernetes with the `quarkus-flow-durable-kubernetes` extension

### 11.2. Further Reading

- [Quarkus Flow State Persistence](https://docs.quarkiverse.io/quarkus-flow/dev/persistence.html)
- [Durable Workflows in Kubernetes](https://docs.quarkiverse.io/quarkus-flow/dev/concepts-durable-workflow-k8s.html)
- [Quarkus Flow Documentation](https://docs.quarkiverse.io/quarkus-flow/dev/index.html)
- [A brief introduction to Quarkus Flow](/posts/a-brief-introduction-to-quarkus-flow)
