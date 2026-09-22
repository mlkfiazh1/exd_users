- **`user-service`**  a NestJS microservice
- **`product-service`**  a second, independent NestJS microservice
- **`mysql`**  a MySQL 8.0 database, currently run with Docker
  Compose

By the end of this guide, this whole stack  `user-service`,
`product-service`, and `mysql`  will be running on Kubernetes.

---

## 1. Why Kubernetes Exists

### 1.1 From monoliths to microservices

Traditionally, applications were built as **monoliths**: one single
codebase containing the UI, business logic, and data access layer,
deployed as one unit.

- Easy to start with, but hard to maintain and update as the app grows.
- A single bug or deploy can bring down the entire application.
- Scaling means scaling *everything*, even the parts that don't need it.

Modern architecture splits an application into **microservices**:
small, independently deployable services that each do one job. Your
own setup is a textbook example: `user-service` owns everything
related to users, `product-service` owns everything related to
products  each can be built, deployed, scaled, and updated
independently, without touching the other.

### 1.2 Containers

Each microservice is packaged and shipped as a **container**  a
lightweight, portable unit that bundles the application code together
with everything it needs to run (runtime, libraries, config).

Your Dockerfile already does exactly this, in two stages:

- **`build` stage**  installs *all* dependencies (`npm install`),
  copies in the source, and compiles it (`npm run build`, producing
  `./dist`).
- **`production` stage**  starts fresh from a clean `node:24.14.1-alpine`
  image, copies in only the *compiled* `dist` folder and `package*.json`
  from the build stage, then installs **only production dependencies**
  (`npm install --omit=dev`). This keeps the final image small and free
  of dev tooling, source TypeScript, and test files.

The result of building this Dockerfile is a portable image  e.g.
`my-registry/user-service:1.0.0` and `my-registry/product-service:1.0.0`
 each one ready to run anywhere Docker (or Kubernetes) can pull it.

### 1.3 Container orchestration

Real systems don't have one container  they have many, spread across
many machines. Right now, Docker Compose is coordinating `mysql`
for you on a single machine. As soon as you have more than one machine,
or need things like automatic restarts, rolling updates, and scaling
based on load, you need a **Container Orchestration** tool. Kubernetes
is the dominant one, with an estimated market share well above 95%.

---

## 2. Docker and Kubernetes: Who Does What

A common point of confusion for beginners: **Kubernetes does not build
container images.** That's Docker's job  exactly what your Dockerfile
already does.

| Task | Tool |
|---|---|
| Build/update a container image from source code | **Docker** (`docker build`)  your two-stage Dockerfile |
| Store images | A **registry** (Docker Hub, GitHub Container Registry, ECR, etc.) |
| Start, stop, schedule, network, and heal containers at scale | **Kubernetes** |

Kubernetes interacts with a **container engine** (often Docker,
sometimes `containerd` directly) to actually schedule and run
containers on a machine. The typical flow for `user-service` (and
identically for `product-service`) is:

1. Write the NestJS code.
2. `docker build -t my-registry/user-service:1.0.0 .`  Docker runs
   your two-stage Dockerfile and produces the image.
3. `docker push my-registry/user-service:1.0.0`  push it to a
   registry Kubernetes can reach.
4. Write a Kubernetes **Manifest** that tells Kubernetes "run this
   image."
5. `kubectl apply -f manifest.yml`  Kubernetes pulls the image and
   runs it as containers, on your behalf.

Kubernetes never creates the image itself  it only ever *consumes*
an image Docker already built.

---

## 3. Kubernetes Manifests

Kubernetes objects (Deployments, Services, StatefulSets, storage,
etc.) are described in **Manifests**: text files, almost always
written in **YAML**, that describe *what* you want.

### 3.1 Declarative, not imperative

This is one of the most important ideas in Kubernetes:

- **Declarative**: you describe the desired *end state* ("I want 3
  replicas of `user-service` running") and Kubernetes figures out how
  to get there and keeps it there.
- **Imperative**: you would instead give step-by-step commands ("start
  container 1", "start container 2", …). Kubernetes manifests are
  **not** written this way.

This matters practically: if a Pod running `product-service` crashes,
you don't have to notice and restart it manually  Kubernetes
continuously compares the actual state of the cluster to the declared
state in your manifest and corrects any drift automatically.

### 3.2 Anatomy of every manifest

Every Kubernetes manifest has (at minimum) these top-level keys:

```yaml
apiVersion: apps/v1        # which version of the Kubernetes API to use for this kind of object
kind: Deployment             # what kind of object this manifest describes
metadata:                    # essential info ABOUT the object itself
  name: user-service
  labels:
    app: user-service
spec:                        # the desired STATE of the object  what you want it to look like
  ...
```

- **`apiVersion`**  Kubernetes has many object types, and they
  evolve over time; this pins which schema/version you're targeting
  (e.g. `apps/v1` for Deployments/StatefulSets, `v1` for Pods/Services,
  `storage.k8s.io/v1` for StorageClasses).
- **`kind`**  the type of Kubernetes object: `Deployment`,
  `StatefulSet`, `Service`, `Pod`, `PersistentVolumeClaim`, `Secret`, etc.
- **`metadata`**  identity information: the object's `name`, and
  `labels` (arbitrary key/value tags used to group and select
  objects  this is how Kubernetes objects find each other).
- **`spec`**  the specification of the *desired state*. This is
  where most of the interesting configuration lives, and its shape
  is different for every `kind`.

Sections can nest quite deep, depending on what you're deploying  a
Deployment's `spec` contains a *Pod template*, which itself has its
own `spec`, which contains its own containers.

---

## 4. `kubectl`  Talking to Kubernetes

`kubectl` (pronounced *"cube control"* or, informally, *"cube
cuddle"*) is the command-line tool used to interact with Kubernetes.

### 4.1 How it works

```
[you]  →  kubectl  →  Kubernetes API  →  Kubernetes Control Plane  →  Nodes
```

`kubectl` reads your manifest file, sends it to the Kubernetes API,
and the **Control Plane** computes what actually needs to happen (e.g.
"create 3 new Pods on Node 2") to reach the state you declared. You
never tell Kubernetes *how*  only *what*.

### 4.2 The core commands

| Command | What it does |
|---|---|
| `kubectl create -f <manifest.yml>` | Create **new** objects from a manifest. `-f` = "file". Fails if the object already exists. |
| `kubectl apply -f <manifest.yml>` | Create new objects **or** update existing ones to match the manifest. This is the one you'll use almost always, because it's safe to re-run. |
| `kubectl get <object>` | List objects of a given kind  a quick overview (e.g. `kubectl get pods`). |
| `kubectl describe <object>` | Detailed information about one specific object  great for debugging *why* something isn't working. |
| `kubectl scale deployment <name> --replicas <n>` | Change the number of running replicas without editing the manifest. |
| `kubectl logs <pod-name>` | Application logs from a specific Pod. |
| `kubectl --help` | Detailed help for any command. |

Objects you'll interact with constantly: `pod`, `deployment`,
`statefulset`, `service`, `pvc` (PersistentVolumeClaim), `pv`
(PersistentVolume), `sc` (StorageClass), `secret`.

**Example, for your services:**

```bash
kubectl apply -f user-service-deployment.yml
kubectl apply -f product-service-deployment.yml
kubectl get pods                              # see if both are running
kubectl describe pod user-service-7f9c8d5     # dig into a specific Pod
kubectl scale deployment product-service --replicas 5
```

---

## 5. Kubernetes Architecture, Piece by Piece

From largest to smallest:

```
Kubernetes Cluster
 └─ Kubernetes Control Plane   (the "brain")
 └─ Nodes                      (the "muscle"  worker machines)
     └─ Pods
         └─ Container(s)
 └─ Services                   (stable networking on top of all of it)
```

### 5.1 Cluster

A **Cluster** is a set of connected computers (**Nodes**) all
configured to run Kubernetes together. These can be physical servers
in a datacenter, or virtual machines in the cloud.

### 5.2 Control Plane

The **Control Plane** is the part of Kubernetes that manages the
whole cluster: it decides which Node a new Pod should run on
(**scheduling**), watches the current state of the cluster, and
continuously reconciles it against the desired state you declared in
your manifests. It's made up of several components that can
themselves run on any node in the cluster.

### 5.3 Nodes

A **Node** is a worker machine  typically running Linux plus a
container engine (like Docker or containerd). Nodes are also called
**worker machines**. Every Node runs an agent called the **Kubelet**,
whose job is to make sure the containers assigned to it are actually
running, inside **Pods**.

### 5.4 Pods

A **Pod** is the **smallest deployable unit** in Kubernetes  you
never deploy a "bare" container directly; you always deploy it inside
a Pod. A Pod is a set of one or more containers that belong together
logically and **share storage and network** (they can talk to each
other over `localhost` and share volumes).

For `user-service` and `product-service`, the simple case is one
container per Pod. They are deployed as **separate** Deployments, each
producing its own family of Pods  they don't share a Pod, because
they're independent microservices that should scale and fail
independently.

**Pods are ephemeral**:
- They can be stopped and recreated at any time.
- They can be moved (rescheduled) to a different Node at any time.
- Each Pod gets a **unique but random, unpredictable identifier** 
  e.g. `user-service-7f9c8d5-x2k9p`  and, in a Deployment, each
  replica Pod is considered "as good as any other" (they're
  interchangeable).
- When a Pod is interrupted, Kubernetes doesn't repair it  it throws
  it away and creates a fresh replica to replace it.

### 5.5 Services

Because Pods are ephemeral and get a **new IP address** every time
they're recreated, you can't reliably point other things (or users) at
a Pod's IP directly. A **Service** solves this: it's a stable network
identity/endpoint that sits in front of a group of Pods (selected by
label) and load-balances traffic across whichever Pods currently
match.

**Services are not ephemeral**  they offer stable network
connectivity even as the Pods behind them come and go.

In your stack: `product-service` never talks to a specific
`user-service` Pod directly  it talks to the **`user-service`
Service** (by DNS name, e.g. `http://user-service:3000`), which
transparently routes to whichever healthy `user-service` Pods
currently exist. Same for `mysql`.

### 5.6 Cheat sheet

| Term | One-line definition |
|---|---|
| **Cluster** | Set of connected Nodes configured to run Kubernetes |
| **Control Plane** | Manages the Nodes in a Cluster; schedules and reconciles state |
| **Node** | A worker machine running Linux + a container engine |
| **Pod** | Smallest deployable unit; one or more containers sharing storage/network |
| **Service** | Stable networking in front of a set of Pods |

---

## 6. Deploying a Stateless Application (Deployments)

### 6.1 What "stateless" means

A **stateless** application does not save any internal state or
context of the data it processes between requests. This is a general
software-design concept, not specific to Kubernetes.

Both `user-service` and `product-service` are stateless: they hold no
data themselves  all persistent data lives in `mysql`. That means
if a Pod running `user-service` is killed, a **brand-new replica** can
start up with zero data loss  it simply starts processing the next
request against the same database. This is exactly why stateless
services map so cleanly onto Kubernetes.

### 6.2 Stateless apps → Deployments

In Kubernetes, "stateless application" translates to the object kind
**`Deployment`**.

Here is a full Deployment manifest for `user-service`, explained line
by line:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  labels:
    app: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
        - name: user-service
          image: my-registry/user-service:1.0.0
        imagePullPolicy: IfNotPresent # only for local with latest tag
          ports:
            - containerPort: 3000
```

Line by line:

- **`apiVersion: apps/v1`**  Deployments live under the `apps` API
  group, version `v1`.
- **`kind: Deployment`**  tells Kubernetes we're describing a
  stateless application.
- **`metadata.name: user-service`**  the Deployment's own name, how
  you refer to it with `kubectl` (`kubectl get deployment
  user-service`).
- **`metadata.labels.app: user-service`**  a tag on the *Deployment
  object itself* (distinct from the Pod labels below).
- **`spec.replicas: 3`**  how many identical Pods should exist. This
  defines the number of *initial* replicas  it can change later via
  scaling (see §7).
- **`spec.selector.matchLabels`**  tells the Deployment which Pods
  belong to it: any Pod carrying the label `app: user-service` is
  considered "mine." This **must match** the labels under
  `template.metadata.labels` below, or Kubernetes will reject the
  manifest.
- **`spec.template`**  a full Pod specification, used as the
  *stamp/template* every replica Pod is created from.
  - **`template.metadata.labels`**  the label actually stamped onto
    each created Pod (this is what the `selector` above matches
    against).
  - **`template.spec.containers`**  the list of containers to run
    inside each Pod (here, just one).
    - **`name: user-service`**  the container's name inside the Pod.
    - **`image: my-registry/user-service:1.0.0`**  which Docker
      image to pull and run  the image your two-stage Dockerfile
      produces. Always pin a specific tag/version in production (not
      `latest`) so deploys are reproducible.
    - **`ports.containerPort: 3000`**  declares that the container
      listens on port 3000 (matching `EXPOSE 3000` and `CMD npm run
      start:prod` in your Dockerfile). This is documentation for
      Kubernetes and other tooling; it doesn't by itself expose
      anything externally (a Service does that  see §5.5 and §10).

How to run it:

`product-service` gets an **identical** manifest, just with
`user-service` swapped for `product-service` everywhere (name, labels,
selector, image, container name):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
  labels:
    app: product-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: product-service
  template:
    metadata:
      labels:
        app: product-service
    spec:
      containers:
        - name: product-service
          image: my-registry/product-service:1.0.0
          ports:
            - containerPort: 3000
```

### 6.3 Deploying it

```bash
docker build -t user-service .
docker build -t product-service .
kubectl apply -f user-service-deployment.yml
kubectl apply -f product-service-deployment.yml
```

What happens next:
1. `kubectl` sends each manifest to the Kubernetes API.
2. The **Control Plane** schedules each Deployment's Pods onto
   available **Nodes**.
3. Each Node's **Kubelet** triggers the actual creation of its
   assigned Pods, pulling the respective image and starting the
   container.
4. Each Pod gets a unique, random name (e.g.
   `user-service-7f9c8d5-abc12`)  because with a Deployment, any one
   replica is "as good as any other."

---

## 7. Scaling and Monitoring a Deployment

### 7.1 Why scale

- **Scale up**  add Pods to handle increasing load (e.g. a traffic
  spike on `product-service`).
- **Scale down**  remove Pods to save compute resources when load
  drops.

Scalability has to be *designed for*. Legacy monolithic applications
typically can't be scaled this way; modern, cloud-native services like
`user-service` and `product-service` are built specifically to support
it  any replica can serve any request, because neither holds state.

### 7.2 How to scale a Deployment

Two equivalent ways:

**Option A  edit the manifest and re-apply** (the declarative way,
preferred for anything tracked in version control):

```yaml
spec:
  replicas: 8   # was 3
```
```bash
kubectl apply -f product-service-deployment.yml
```

**Option B  imperative one-off command:**

```bash
kubectl scale deployment product-service --replicas 8
```

Note this second form is *imperative* (a one-time instruction) and
will be overwritten the next time you `apply` a manifest that still
says `replicas: 3`  so for anything permanent, update the manifest.

### 7.3 Monitoring

**Monitoring** means observing your running application in real time
so you can react to problems (crashes, load spikes, failed
deployments).

Purpose-built tools like **Prometheus** and **Grafana** are the
standard for production-grade monitoring and dashboards. For quick,
basic checks, `kubectl` itself is enough:

```bash
kubectl get pods                        # status of every Pod (Running, CrashLoopBackOff, Pending...)
kubectl logs <pod-name>                 # application logs from a specific Pod
kubectl get deployment user-service     # replica counts: desired vs. available

# port-forward 
kubectl port-forward deployment/user-service 3000:3000

# To stop the Kubernetes application while keeping its configuration
kubectl scale deployment user-service --replicas=0

#To start it again
kubectl scale deployment user-service --replicas=8

# To completely remove the deployment
kubectl delete deployment user-service
```

Example: `kubectl get pods` after scaling `product-service` to 8
replicas should show 8 `product-service-...` Pods, all `Running`,
alongside your 3 `user-service-...` Pods.

---

## 8. Deploying a Stateful Application (StatefulSets)

### 8.1 Recap: stateless vs. stateful

- **Stateless** apps (→ `Deployment`): every Pod has exactly the same
  job; any replica can serve any request; Pods are interchangeable.
  This is `user-service` and `product-service`.
- **Stateful** apps (→ `StatefulSet`): Pods belong together as a set,
  but individual Pods may play **different roles** and work with
  **different data**. They need to **save state** so that if a Pod is
  interrupted, a *new* replica can pick up exactly where the old one
  left off. This is `mysql`.

If `mysql` is running with 3 Pods (e.g. one primary + two
replicas), each Pod plays a distinct role, and every write needs to be
*persisted*  it can't just vanish if a Pod restarts. When a Pod
terminates, its replacement needs to pick up the same saved data, not
start from empty.

Much of what applies to Deployments also applies to StatefulSets 
same `apiVersion`/`kind`/`metadata`/`spec`/`template` shape, same
`replicas`.

### 8.2 A StatefulSet manifest for `mysql`, line by line

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  labels:
    app: mysql
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          ports:
            - containerPort: 3306
          envFrom:
            - secretRef:
                name: mysql-credentials
```

This looks almost identical to the Deployment manifests above  the
main difference so far is `kind: StatefulSet` instead of `kind:
Deployment`. Notes on this manifest specifically:

- **`spec.replicas: 1`**  started at 1 because a single MySQL
  instance is the simplest, most common setup (matching what your
  Docker Compose file already runs). A production MySQL cluster with
  replication would use more replicas  see §8.4.
- **`image: mysql:8.0`**  the exact same image tag your Docker
  Compose file uses.
- **`ports.containerPort: 3306`**  MySQL's default port *inside the
  container*. Your Compose file maps this to host port `6446`
  (`"6446:3306"`) purely so you can reach it from your laptop; inside
  a Kubernetes cluster no such host-port mapping is needed  other
  Pods reach it through a **Service** on port `3306` directly (§10).
- **`envFrom.secretRef.name: mysql-credentials`**  replaces the
  Compose `environment: MYSQL_ROOT_PASSWORD: password` block. Instead
  of a plaintext password in a YAML file, the password is stored in a
  Kubernetes **Secret** and injected as an environment variable (§10.1).

The real behavioral differences between a StatefulSet and a Deployment
show up once it's **deployed** (§8.3) and when it's **scaled** (§8.4)
 and, just like your Compose file's `volumes: mysql:` block, a
real MySQL StatefulSet also needs a storage section, covered in §9.

### 8.3 Deploying a StatefulSet  how it differs from a Deployment

```bash
kubectl apply -f mysql-statefulset.yml
```

Deployed the exact same way as a Deployment, but Kubernetes treats it
very differently once running:

| | Deployment | StatefulSet |
|---|---|---|
| Pod creation order | All at once | **One after the other**, in order |
| Pod names | Random, unpredictable (`user-service-7f9c8d5-x2k9p`) | **Predictable**, ordinal (`mysql-0`, `mysql-1`, …) |
| Pod identity | None  any replica is interchangeable | Each Pod has a **stable identity and state** |

This is the core reason StatefulSets exist: because Pods have stable,
predictable names and identities, different Pods of the *same*
StatefulSet can perform **different roles** in the application  e.g.
`mysql-0` as primary, `mysql-1`/`mysql-2` as read
replicas  something you cannot reliably build on top of a
Deployment's interchangeable, randomly-named Pods.

### 8.4 Scaling a StatefulSet

If you later move from a single MySQL instance to a replicated setup,
the same two mechanisms as a Deployment apply:

```yaml
spec:
  replicas: 3   # scale up from 1
```
```bash
kubectl apply -f mysql-statefulset.yml
#  or 
kubectl scale statefulsets mysql --replicas 3
```

But the *ordering* is different and matters:

- **Scaling up** creates new Pods **one after another, in order**:
  from `mysql-0` (already running), it adds `mysql-1` first,
  waits for it to be ready, *then* adds `mysql-2`.
- **Scaling down** removes the **most recently created Pods first**:
  from 3 replicas back down to 1 means `mysql-2` is deleted first,
  then `mysql-1`  leaving `mysql-0` untouched.

This ordered, predictable behavior is essential for stateful systems
like databases, where Pod `-0` might be the elected primary and you
don't want it torn down arbitrarily.

### 8.5 Monitoring a StatefulSet

Same commands as for a Deployment:

```bash
kubectl get pods              # shows mysql-0 (and -1, -2, ... if scaled) with status
kubectl get services          # shows the Services mysql uses
```

`kubectl get pods` for a StatefulSet is particularly useful because,
unlike a Deployment's randomly-named Pods, you can immediately tell
*which specific* replica is unhealthy.

---

## 9. Kubernetes Storage

### 9.1 The problem

Pods are ephemeral  but the data inside `mysql` absolutely is
not allowed to be. Your Docker Compose file already solves this on a
single machine with a named volume (`volumes: mysql:` mounted at
`/var/lib/mysql`). Kubernetes needs the equivalent: a way to
**separate storage from compute**, so data survives even when the Pod
using it is stopped, killed, rescheduled to a different Node, or
replaced entirely.

### 9.2 The three storage objects

Kubernetes storage is built from exactly three object kinds:

1. **`PersistentVolume` (PV)**  an actual piece of storage
   (provisioned alongside Pods, existing independently of any one of
   them).
2. **`PersistentVolumeClaim` (PVC)**  a *request/claim* for storage,
   made by/for a Pod. This is the mechanism that maps a PV to a Pod.
3. **`StorageClass` (SC)**  defines *what kind* of storage a PV
   should be provisioned as: latency profile, disk type (e.g. SSD vs
   HDD), backup strategy, etc.

The flow:

```
Pod  --wants persisted data-->  PersistentVolumeClaim
                                        │
                          Kubernetes creates a
                                        ▼
                              PersistentVolume  <── provisioned according to a
                                                     named StorageClass
                                        │
                        mapped back to the claiming Pod
```

- A Pod that needs persisted data uses a **PersistentVolumeClaim**.
- That PVC causes Kubernetes to create a matching **PersistentVolume**
  for the Pod.
- That PersistentVolume gets mapped to the claiming Pod.
- A named **StorageClass** controls the *kind* of PersistentVolume
  created  its latency, backup policy, etc.
- Crucially: that PersistentVolume  and the data on it  **survives
  even when the Pod is terminated**. This is exactly what `mysql`
  needs, and exactly what the Compose `volumes:` block was already
  giving you on a single machine.

### 9.3 Provisioning: manual vs. dynamic

PersistentVolumes can be provisioned:
- **Manually**, by a Kubernetes admin who creates the PV ahead of
  time, or
- **Dynamically**, by a regular user, via a StorageClass  no human
  intervention required. This is the far more common approach in
  practice, and the one used below.

**Rule of thumb the course gives: "If in doubt, use Storage
Classes."**

### 9.4 Manifests, line by line

**PersistentVolumeClaim with a StorageClass:**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
spec:
  storageClassName: "standard"
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

- **`kind: PersistentVolumeClaim`**  this manifest is a *request*
  for storage, not the storage itself.
- **`metadata.name: mysql-pvc`**  the name other objects (like
  the Pod, below) will reference to use this claim.
- **`spec.storageClassName: "standard"`**  which StorageClass to
  dynamically provision from (cluster admins define what "standard"
  means  e.g. SSD-backed, daily-backed-up storage).
- **`spec.accessModes: [ReadWriteOnce]`**  how many Pods, and how,
  can mount this volume simultaneously. `ReadWriteOnce` = one Node can
  mount it read/write at a time (the correct choice for MySQL's own
  data directory). Other values exist (`ReadOnlyMany`,
  `ReadWriteMany`) for shared/read-heavy use cases.
- **`spec.resources.requests.storage: 10Gi`**  how much storage to
  request  here, 10 gibibytes for MySQL's data (the equivalent of
  your Compose `mysql:` named volume, but now with an explicit
  size).

**The StatefulSet from §8.2, extended to mount that storage:**

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  labels:
    app: mysql
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          ports:
            - containerPort: 3306
          envFrom:
            - secretRef:
                name: mysql-credentials
          volumeMounts:
            - name: mysql-data
              mountPath: /var/lib/mysql
      volumes:
        - name: mysql-data
          persistentVolumeClaim:
            claimName: mysql-pvc
```

New parts, line by line:

- **`spec.template.spec.containers[].volumeMounts`**  inside the
  container, mount a volume (named `mysql-data`, matching the name
  defined below) at path `/var/lib/mysql`  the **exact same path**
  your Compose file already mounts (`mysql:/var/lib/mysql`).
  Anything MySQL writes there is now persisted, not lost with the
  container's filesystem.
- **`spec.template.spec.volumes`**  defines, at the Pod level, where
  that named volume actually comes from.
  - **`persistentVolumeClaim.claimName: mysql-pvc`**  points at
    the PVC defined above, which is what actually ties this Pod to a
    real, persistent piece of storage.

In practice, once you scale `mysql` beyond 1 replica (§8.4), you'd
switch to a StatefulSet's dedicated `volumeClaimTemplates` field
instead of a single shared PVC  it automatically creates **one PVC
per replica**, so `mysql-0`, `mysql-1`, and `mysql-2` each
get their own separate, persistent volume, which is exactly what a
replicated database needs.

### 9.5 `kubectl` commands for storage

```bash
kubectl get sc      # list all available StorageClasses
kubectl get pvc      # list all deployed PersistentVolumeClaims
kubectl get pv       # list all deployed PersistentVolumes
kubectl apply -f <manifest>   # as always, deploy storage resources declared in a manifest
```

---

## 10. Putting the Whole Stack Together

### 10.1 Secrets (replacing the Compose `environment:` block and `.env` file)

Your Compose file stores `MYSQL_ROOT_PASSWORD: password` directly in
plain text, and your Dockerfiles `COPY .env ./.env` straight into the
image. Neither is ideal for a real cluster shared by a team. Kubernetes'
equivalent is a **Secret**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mysql-credentials
type: Opaque
stringData:
  MYSQL_ROOT_PASSWORD: password
  DB_HOST: mysql
  DB_PORT: "3306"
```

- **`kind: Secret`**  an object for storing sensitive values (as
  opposed to a `ConfigMap`, its non-sensitive equivalent).
- **`type: Opaque`**  a generic, free-form Secret (as opposed to
  Kubernetes' more specialized built-in Secret types, e.g. for TLS
  certificates or registry credentials).
- **`stringData`**  plain-text key/value pairs you supply; Kubernetes
  stores them base64-encoded internally. This is exactly what got
  referenced back in §6.2, §8.2, and §9.4 via `envFrom.secretRef.name:
  mysql-credentials`  every Pod that references it gets
  `MYSQL_ROOT_PASSWORD`, `DB_HOST`, and `DB_PORT` injected as
  environment variables automatically, without ever baking them into
  an image.

*(In a real classroom/production setting, don't commit Secret
manifests with real passwords to version control  this is shown here
purely to teach the mechanism.)*

### 10.2 Services for `user-service`, `product-service`, and `mysql`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
spec:
  selector:
    app: user-service
  ports:
    - port: 3000
      targetPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: product-service
spec:
  selector:
    app: product-service
  ports:
    - port: 3000
      targetPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: mysql
spec:
  selector:
    app: mysql
  ports:
    - port: 3306
      targetPort: 3306
```

- **`spec.selector`**  this is the label-matching link back to §5.5:
  each Service routes traffic to any Pod whose labels match (e.g.
  `app: user-service`), which is exactly the label every Pod in the
  `user-service` Deployment carries (§6.2).
- **`spec.ports.port`**  the port the Service itself listens on.
- **`spec.ports.targetPort`**  the port *on the Pod* to forward
  traffic to (matches `containerPort` from the Deployment/StatefulSet).
- The three manifests are separated by `---`, which lets you keep
  multiple objects in one YAML file.

Once the `mysql` Service exists, both `user-service` and
`product-service` can reach the database at the hostname
`mysql` on port `3306`  Kubernetes provides this DNS resolution
automatically inside the cluster, the same way `mysql` (the
container name) is directly reachable from other containers on the
`mysql` Docker network today.

### 10.3 The full picture

```
                     ┌───────────────────────────┐
   users  ──────────▶│  Service: user-service      │  (stable entrypoint)
                     └──────────────┬─────────────┘
                                    │ load-balances to
                     ┌──────────────▼─────────────┐
                     │  Deployment: user-service     │
                     │  (stateless, 3 replicas)      │
                     └──────────────┬─────────────┘
                                    │
                     ┌──────────────▼─────────────┐
   users  ──────────▶│  Service: product-service    │  (stable entrypoint)
                     └──────────────┬─────────────┘
                                    │ load-balances to
                     ┌──────────────▼─────────────┐
                     │  Deployment: product-service  │
                     │  (stateless, 3 replicas)      │
                     └──────────────┬─────────────┘
                                    │ both talk to
                     ┌──────────────▼─────────────┐
                     │  Service: mysql           │  (stable entrypoint)
                     └──────────────┬─────────────┘
                                    │ routes to
                     ┌──────────────▼─────────────┐
                     │  StatefulSet: mysql        │
                     │  (stateful, ordered Pods)      │
                     └──────────────┬─────────────┘
                                    │ backed by
                     ┌──────────────▼─────────────┐
                     │  PVC → PV (via StorageClass)   │
                     │  (survives Pod restarts)       │
                     └───────────────────────────┘

           Secret: mysql-credentials
           (injected into user-service, product-service, and mysql)
```

### 10.4 Deployment order in practice

```bash
kubectl apply -f mysql-secret.yml
kubectl apply -f mysql-pvc.yml
kubectl apply -f mysql-statefulset.yml
kubectl apply -f mysql-service.yml
kubectl apply -f user-service-deployment.yml
kubectl apply -f user-service-svc.yml
kubectl apply -f product-service-deployment.yml
kubectl apply -f product-service-svc.yml

kubectl get pods       # confirm everything is Running
kubectl get services   # confirm all three Services have stable endpoints
```

---

## 11. Practice Exercises

Work through these using the manifests above as a starting point.

1. **Deployments**  `product-service` currently has `replicas: 3`.
   Change it to `5` in the manifest, re-`apply`, and confirm with
   `kubectl get pods` that you now see 5 `product-service-...` Pods
   alongside 3 `user-service-...` Pods.

2. **Scaling**  Scale `user-service` from 3 to 6 replicas using the
   imperative `kubectl scale` command. Then edit the manifest to say
   `replicas: 6` too, and explain in your own words why that second
   step matters.

3. **Services**  Explain, in one or two sentences, why
   `product-service` needs a Service in front of `mysql` rather
   than connecting directly to a specific `mysql-0` Pod IP.

4. **StatefulSets**  What would go wrong if `mysql` were deployed
   as a `Deployment` instead of a `StatefulSet`? Consider Pod naming,
   Pod identity, and what happens to data on restart in your answer.

5. **Storage**  Change the `mysql-pvc` manifest to request `20Gi`
   instead of `10Gi`, using a StorageClass called `fast-ssd` instead of
   `standard`. Which manifest(s) would you need to re-apply afterward?

6. **Secrets**  Add a new key, `MYSQL_DATABASE: shopdb`, to the
   `mysql-credentials` Secret, so a default database gets created
   on startup. Which manifests reference this Secret and would pick up
   the new value automatically?

7. **Debugging**  A student runs `kubectl apply -f
   user-service-deployment.yml` and then `kubectl get pods` shows 0
   Pods for `user-service`. List three `kubectl` commands you'd run
   next, and what each one would tell you.

8. **Conceptual**  In your own words, explain the difference between
   `kubectl create -f` and `kubectl apply -f`, and why almost everyone
   defaults to `apply`.

9. **From Compose to Kubernetes**  Compare your Docker Compose
   `mysql` service to the Kubernetes manifests in §8–§10. Match
   each Compose key (`image`, `environment`, `ports`, `volumes`,
   `networks`, `restart`) to the Kubernetes concept that replaces it.