# ZeniManager — 상담 관리 시스템

> **제니엘(Zeniel)** 취업 지원 사업의 상담 업무를 효율적으로 관리하기 위한 React 기반 데스크탑 앱(Electron 변환 가능) 및 웹 애플리케이션입니다.

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=flat-square&logo=tailwindcss" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase" />
  <img src="https://img.shields.io/badge/Electron-41-47848F?style=flat-square&logo=electron" />
</p>

---

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [화면 구성](#화면-구성)
- [시작하기](#시작하기)
- [Supabase 설정](#supabase-설정)
- [Electron 데스크탑 빌드](#electron-데스크탑-빌드)
- [프로젝트 구조](#프로젝트-구조)
- [보안 정책](#보안-정책)
- [라이선스](#라이선스)

---

## 주요 기능

### 상담사 포털
- **업무 대시보드**: 전체 상담자 수, 프로세스 현황, 월별 차트, 캘린더, 칸반 메모장
- **상담자 목록**: 전체 / 점수 미확정 / 후속 상담 / 취업 처리 필터 탭, 상세 모달(상담관리·상담이력·상담내용 입력)
- **상담자 등록**: 신규 상담자 정보 입력 폼
- **구직준비도 설문 관리**: 8문항 설문 입력·조회·수정 (총점 자동 계산)

### 관리자 포털
- **사업 대시보드**: 지점별 / 사업별(유형) / 취업구분(성사율) 탭 차트
- **상담사 목록**: 상담사 CRUD, CSV 내보내기
- **상담자 목록**: 전체 상담자 조회 및 관리

### 공통
- **역할 기반 접근 제어**: 상담사 / 관리자 역할 분리 (Supabase RLS 적용)
- **보안 키 관리**: API 키를 코드에 포함하지 않고 앱 Settings에서 런타임 입력
- **Supabase 연동**: 실시간 데이터 저장·조회, 미설정 시 목업 데이터로 자동 전환

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, TypeScript, Vite 7, TailwindCSS 4 |
| UI 컴포넌트 | shadcn/ui (Radix UI), Recharts, Lucide Icons |
| 데이터베이스 | Supabase (PostgreSQL) |
| 인증 | Supabase Auth |
| 데스크탑 | Electron 41, electron-builder |
| 폰트 | Noto Sans KR (Google Fonts) |
| 테스트 | Vitest |

---

## 화면 구성

```
로그인
├── 역할 선택 (상담사 / 관리자)
├── 이메일 / 비밀번호 입력
└── Supabase 연결 설정 (접기/펼치기)

상담사 (고정 사이드바)
├── 업무 대시보드
│   ├── 통계 카드 (전체 상담자 수, 프로세스 현황)
│   ├── 월별 상담 차트
│   ├── 캘린더
│   └── 칸반 메모장
├── 상담자 목록
│   ├── 검색 (전체 / 점수미확정 / 후속상담 / 취업처리)
│   ├── 상담자 테이블
│   └── 상세 모달 (상담관리 · 상담이력 · 상담내용 입력 · 구직준비도 설문)
└── 상담자 등록

관리자 (고정 사이드바)
├── 사업 대시보드
│   ├── 지점별 통계
│   ├── 사업별(유형) 통계
│   └── 취업구분(성사율) 통계
├── 상담사 목록
└── 상담자 목록
```

---

## 시작하기

### 사전 요구사항

- Node.js 18 이상
- Corepack 사용 가능 환경 권장 (`corepack enable`)
- pnpm 10 이상 (전역 설치를 이미 사용 중인 경우)

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/SuranS2/ZeniManager.git
cd ZeniManager

# 2-A. Corepack 사용 시 (최초 1회)
corepack enable

# 2-B. 전역 pnpm 설치 시 (둘 중 하나만 선택)
npm install -g pnpm

# 3. 의존성 설치
corepack pnpm install

# 4. 개발 서버 실행 (웹 브라우저)
corepack pnpm dev

# 5. Electron 개발 모드 실행 (데스크탑 창)
corepack pnpm electron:dev
```

전역 `pnpm`을 설치했다면 아래처럼 `corepack` 없이 실행해도 됩니다.

```bash
pnpm install
pnpm dev
pnpm electron:dev
```

PowerShell에서 `npm` 또는 `pnpm` 스크립트 실행이 막히면 새 터미널을 다시 열거나 `npm.cmd`, `pnpm.cmd`로 실행하세요.

`pnpm install` 시 Electron 바이너리가 누락된 상태면 `postinstall`에서 자동 복구합니다. 이미 설치를 마친 뒤 `Electron failed to install correctly` 오류가 발생하면 `pnpm electron:ensure`를 한 번 실행한 뒤 다시 `pnpm electron:dev`를 실행하세요.

`pnpm dev`는 Vite 개발 서버를 구동하며 기본 접속 주소는 `http://localhost:5173`입니다.

Windows에서도 `pnpm dev`가 동작하도록 `package.json`의 개발/실행 스크립트는 `cross-env`를 사용합니다.

### 데모 계정 (Supabase 미설정 시)

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 상담사 | `counselor@example.com` | `REDACTED` |
| 관리자 | `admin@example.com` | `REDACTED` |

---

## Supabase 설정

### 1단계: 스키마 적용

1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 선택
2. 좌측 메뉴 **SQL Editor** 클릭
3. 프로젝트 루트의 `supabase_setup.sql` 파일 내용을 붙여넣고 **Run** 실행

### 2단계: 테스트 계정 생성

Supabase 대시보드 → **Authentication** → **Users** → **Add user** 에서 계정 생성:

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 상담사 | `counselor@example.com` | `REDACTED` |
| 관리자 | `admin@example.com` | `REDACTED` |

생성 후 `supabase_setup.sql` 하단 주석의 INSERT 문에 UUID를 입력하여 실행합니다.

### 3단계: 앱에서 연결

앱 로그인 화면 하단 **Supabase 연결 설정** 또는 로그인 후 **설정** 메뉴에서:

- **Project URL**: `https://your-project-id.supabase.co`
- **Anon Key**: Supabase 대시보드 → Settings → API → `anon public` 키

> 입력된 키는 기기의 `localStorage`에만 저장되며 외부로 전송되지 않습니다.

---

## Electron 데스크탑 빌드

자세한 내용은 [ELECTRON_BUILD.md](./ELECTRON_BUILD.md)를 참고하세요.

```bash
# Windows 설치 파일 (.exe)
pnpm electron:build:win

# macOS DMG
pnpm electron:build:mac

# Linux AppImage
pnpm electron:build:linux
```

빌드 결과물은 `release/{version}/` 디렉토리에 생성됩니다.

> **아이콘 준비 필요**: 빌드 전 `electron/icons/README.md`를 참고하여 아이콘 파일을 추가해야 합니다.

---

## 프로젝트 구조

```
ZeniManager/
├── client/                    # 프론트엔드 (React + Vite)
│   └── src/
│       ├── components/        # 공통 UI 컴포넌트
│       ├── contexts/          # React Context (Auth 등)
│       ├── hooks/             # 커스텀 훅 (useElectron 등)
│       ├── lib/               # Supabase 클라이언트, API 레이어, 목업 데이터
│       └── pages/
│           ├── counselor/     # 상담사 페이지 (Dashboard, ClientList, ClientRegister)
│           ├── admin/         # 관리자 페이지 (AdminDashboard, CounselorList, AdminClientList)
│           ├── Login.tsx
│           └── Settings.tsx
├── electron/                  # Electron 메인 프로세스
│   ├── main.cjs               # BrowserWindow, IPC, 네이티브 메뉴
│   ├── preload.cjs            # contextBridge IPC 브릿지
│   ├── entitlements.mac.plist # macOS 권한 설정
│   └── icons/                 # 앱 아이콘 (빌드 전 추가 필요)
├── supabase_setup.sql         # Supabase 스키마 + RLS 정책
├── electron-builder.yml       # Electron 빌드 설정
├── vite.electron.config.ts    # Electron 전용 Vite 설정
└── ELECTRON_BUILD.md          # Electron 빌드 가이드
```

---

## 보안 정책

이 프로젝트는 GitHub 공개 저장소에 안전하게 올릴 수 있도록 설계되었습니다.

- **API 키 미포함**: Supabase URL, Anon Key, Service Role Key 등 모든 자격증명은 코드에 포함되지 않으며 앱 Settings에서 런타임에 입력합니다.
- **개인정보 파일 제외**: `.gitignore`에 `*.xlsx`, `*.xls`, `*.csv`, 개인정보 포함 PDF 파일이 포함되어 있습니다.
- **환경 변수**: `.env` 파일은 `.gitignore`에 의해 Git에 포함되지 않습니다. 환경 변수 예시는 `env.example.txt`를 참고하세요.
- **Supabase RLS**: 각 상담사는 자신이 담당하는 상담자 데이터만 조회·수정할 수 있습니다.

---

## 스크립트 요약

| 스크립트 | 설명 |
|----------|------|
| `pnpm dev` | 웹 개발 서버 실행 |
| `pnpm build` | 웹 프로덕션 빌드 |
| `pnpm electron:ensure` | Electron 바이너리 수동 복구 |
| `pnpm electron:dev` | Electron 개발 모드 |
| `pnpm electron:build:win` | Windows 설치 파일 빌드 |
| `pnpm electron:build:mac` | macOS DMG 빌드 |
| `pnpm electron:build:linux` | Linux AppImage 빌드 |
| `pnpm test` | 단위 테스트 실행 |

---

## 라이선스

Copyright © 2024 [Zeniel](https://www.zeniel.com). All rights reserved.
