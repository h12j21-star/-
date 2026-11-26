# CertBear 테스트베드

CertBear 모듈(admin·ui·에이전트 서버 4대·k8s·aws)을 도커로 띄우고, 웹 페이지에서 모듈별로 ON/OFF 합니다.

```
┌──────────── 제어 페이지 http://localhost:7000 (control) ─────────────┐
│  docker.sock 으로 docker compose up/stop 을 실행                    │
└──────────────────────────────────────────────────────────────────────┘
  써트베어      ui(nginx :8443) ──/api──▶ admin(:6680/:6681) ──▶ db(postgres)
  에이전트 서버  target-nginx-1 · target-nginx-2 · target-apache · target-tomcat
                (웹서버 + certbear-agent, admin:6681 로 등록)
  클라우드      k8s(k3s :6443) · aws(moto, TLS :443)
                 └ admin 에서 KUBERNETES / AWS 장비로 등록해 사용
```

## 준비

1. Docker(Desktop) 설치.
2. 소스 폴더를 이 저장소와 **같은 폴더**에 둡니다 (경로가 다르면 `.env` 에서 지정).
   ```
   작업폴더/
   ├─ -/testbed        ← 이 저장소
   ├─ certbear-admin
   ├─ certbear-ui
   └─ certbear-agent
   ```
3. 설정 파일 복사 (기본값 그대로 써도 됩니다).
   ```bash
   cp .env.example .env
   ```
   PC 의 UI 폴더 이름이 `ui` 라면 `.env` 에 `UI_SRC=../../ui` 처럼 바꿉니다.

## 실행

### 도커로 (권장)

```bash
docker compose up -d --build control
```

브라우저에서 http://localhost:7000 을 열고 모듈마다 **ON / OFF** 를 누릅니다.
처음 ON 할 때는 이미지를 빌드하므로 수 분 걸립니다. 진행 상황은 카드의 **진행 로그** 로 봅니다.
소스를 고친 뒤 OFF → ON 하면 바뀐 부분만 다시 빌드합니다.

### 로컬에서 (Node 22 + docker CLI)

```bash
node control/server.js
```

같은 페이지가 http://localhost:7000 에 뜹니다. 이때는 `.env` 의 소스 경로를 그대로 씁니다.

### 페이지 없이 직접

```bash
docker compose --profile admin --profile ui up -d --build
```

```bash
docker compose --profile '*' stop
```

## 모듈과 접속 정보

| 모듈 | 서비스 | 접속 | 비고 |
|---|---|---|---|
| Admin + DB | `db`, `admin` | https://localhost:6680 (manager), :6681 (agent) | 최초 기동 때 `migration:run` → 계정 **admin / admin** |
| UI | `ui` | https://localhost:8443 | 자체서명 인증서 (브라우저 경고 무시) |
| 서버 1 | `target-nginx-1` | https://localhost:9441 | nginx + agent |
| 서버 2 | `target-nginx-2` | https://localhost:9442 | nginx + agent |
| 서버 3 | `target-apache` | https://localhost:9443 | Apache httpd + agent |
| 서버 4 | `target-tomcat` | https://localhost:9444 | Tomcat 10(PEM) + agent |
| Kubernetes | `k8s` | API https://localhost:16443 | 컨테이너 안에서는 `https://certbear.k3s:6443` |
| AWS | `aws` | https://localhost:14566 | moto 모의 서버 |

### 에이전트 서버

- 각 컨테이너는 기동 시 자체서명 인증서 `/etc/certbear-test/server.crt|key` 를 만들고 웹서버를 띄운 뒤
  `certbear-master -a -c agent-config.json` 로 에이전트를 실행합니다 (설치 토큰 없이 **수동 설치 등록**).
- admin 이 꺼져 있으면 에이전트는 등록을 재시도하므로 순서와 상관없이 켜도 됩니다.
- 에이전트 로그는 **컨테이너 로그** 버튼으로 봅니다.

### Kubernetes (k3s) 등록

admin 에서 장비(KUBERNETES)를 추가할 때:
- API 주소: `https://certbear.k3s:6443`
- 토큰: 카드의 **SA 토큰 보기** (ServiceAccount `certbear-test/certbear-admin`, 테스트용이라 cluster-admin 권한)
- 미리 만든 리소스: 네임스페이스 `certbear-test` 의 TLS 시크릿 `sample-tls`, 이를 마운트한 디플로이먼트 `sample-web`

### AWS (moto) 등록

admin 에서 클라우드(AWS)를 추가할 때:
- Access Key `testing` / Secret Key `testing` / 리전 `ap-northeast-2`
- 경유 서버(endpoint): `https://certbear.aws:443`
  admin 은 경유 서버로 TLS 를 릴레이하면서 Host·SNI 는 AWS 호스트로 보내고, moto 가 Host 로 서비스를 구분합니다.
- 미리 만든 리소스: ACM 인증서 1개(`app.certbear-test.local`), 이를 쓰는 ALB `certbear-test-alb` 의 HTTPS 리스너

## 라이선스

admin 은 `/app/license/license.dat` 가 없으면 라이선스 미등록 상태로 뜹니다. 로그인·UI 는 되지만
**에이전트 등록은 `403 LICENSE_BLOCKED` 로 거부**됩니다. 이때 에이전트 서버 컨테이너는 웹서버를 유지한 채
30초마다 에이전트를 다시 띄우므로, 라이선스를 넣으면 자동으로 등록됩니다. 테스트 라이선스가 있으면:

```bash
docker cp license.dat certbear.admin:/app/license/license.dat
```

```bash
docker restart certbear.admin
```

(`admin_license` 볼륨에 저장되어 재생성 후에도 유지됩니다.)

## 이미지 빌드 방식

| 이미지 | 빌드 |
|---|---|
| admin | `certbear-admin/Dockerfile` 그대로. 사내 레지스트리의 `certbear-admin-base` 는 `images/admin-base`(certbear-infra `admin/Dockerfile.base` 사본)를 로컬 빌드해 같은 이름으로 덮어씁니다 — **레지스트리 로그인 불필요** |
| ui | `certbear-ui` 를 `yarn build` → nginx (`images/ui` 의 nginx.conf·템플릿은 certbear-infra 사본) |
| 에이전트 서버 | `certbear-agent/rust-based` 를 `cargo build --release` → 웹서버 이미지에 복사 |
| db | postgres:16 + `uuid-ossp` 확장 |

## 초기화

```bash
docker compose --profile '*' down -v
```

DB·라이선스·k3s 데이터까지 지웁니다.
