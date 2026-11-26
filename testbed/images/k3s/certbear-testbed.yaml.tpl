apiVersion: v1
kind: Namespace
metadata:
  name: certbear-test
---
# admin 의 KUBERNETES 벤더 등록용 ServiceAccount (테스트베드라 cluster-admin)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: certbear-admin
  namespace: certbear-test
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: certbear-admin
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: ServiceAccount
    name: certbear-admin
    namespace: certbear-test
---
apiVersion: v1
kind: Secret
metadata:
  name: certbear-admin-token
  namespace: certbear-test
  annotations:
    kubernetes.io/service-account.name: certbear-admin
type: kubernetes.io/service-account-token
---
apiVersion: v1
kind: Secret
metadata:
  name: sample-tls
  namespace: certbear-test
type: kubernetes.io/tls
data:
  tls.crt: @TLS_CRT@
  tls.key: @TLS_KEY@
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-web
  namespace: certbear-test
spec:
  replicas: 1
  selector:
    matchLabels: { app: sample-web }
  template:
    metadata:
      labels: { app: sample-web }
    spec:
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          volumeMounts:
            - { name: tls, mountPath: /etc/tls, readOnly: true }
      volumes:
        - name: tls
          secret: { secretName: sample-tls }
