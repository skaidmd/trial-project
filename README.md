# 家族のToDoリスト

家族間でシームレスに使える、セキュアな共有ToDoアプリケーションです。Next.js (App Router) とSupabaseで構築されています。

## 主な機能

- 🔐 **セキュアな認証**: メールアドレスとパスワードによる認証
- 📱 **モバイルファースト**: スマートフォンでの片手操作に最適化
- 🏷️ **カテゴリ管理**: 「お使い」「イベント」「その他」でタスクを整理
- 🔄 **リアルタイム同期**: 家族全員のタスクがリアルタイムに同期
- 🔒 **RLS（Row Level Security）**: 認証済みユーザーのみがデータにアクセス可能

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)にアクセスし、新しいプロジェクトを作成
2. プロジェクトの設定画面から以下の情報を取得:
   - Project URL
   - Anon Key

### 3. 環境変数の設定

`.env.local.example`を`.env.local`にコピーし、Supabaseの認証情報を設定してください:

```bash
cp .env.local.example .env.local
```

`.env.local`を編集:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. データベーススキーマの適用

Supabaseのダッシュボードで、SQL Editorを開き、`schema.sql`の内容を実行してください:

1. Supabaseダッシュボード → SQL Editor
2. `schema.sql`の内容をコピー&ペースト
3. 「Run」をクリックして実行

これにより、`tasks`テーブルとRLSポリシーが作成されます。

### 5. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) をブラウザで開いてください。

## 使い方

### 初回利用

1. `/login`にアクセス
2. 「新規登録」をクリック
3. メールアドレスとパスワードを入力して登録
4. 確認メールが届くので、リンクをクリックして認証を完了

### タスクの管理

- **追加**: カテゴリを選択し、タスク名を入力して「追加」ボタンをクリック
- **完了**: チェックボックスをタップして完了/未完了を切り替え
- **削除**: ゴミ箱アイコンをタップしてタスクを削除

### 家族での共有

現在の実装では、各ユーザーが自分のタスクのみを管理できます。家族全員でタスクを共有したい場合は、以下の方法があります:

1. **同じアカウントでログイン**: 全員が同じメールアドレス/パスワードでログイン
2. **カスタマイズ**: RLSポリシーを変更して、特定のグループ内でタスクを共有

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router), React, TypeScript
- **スタイリング**: Tailwind CSS
- **バックエンド**: Supabase (PostgreSQL, Authentication, Realtime)
- **認証**: Supabase Auth
- **データベース**: PostgreSQL with Row Level Security

## プロジェクト構成

```
.
├── app/
│   ├── page.tsx          # メインのToDoリスト画面
│   ├── login/
│   │   └── page.tsx      # ログイン/新規登録画面
│   └── layout.tsx
├── src/
│   └── utils/
│       └── supabase/     # Supabaseクライアント
│           ├── client.ts    # クライアント側
│           ├── server.ts    # サーバー側
│           └── middleware.ts # ミドルウェア用
├── middleware.ts         # 認証チェック
├── schema.sql            # データベーススキーマ
└── .env.local.example    # 環境変数テンプレート
```

## デプロイ

### Vercelへのデプロイ

#### 1. GitHubにプッシュ

```bash
git add .
git commit -m "Add Supabase integration"
git push origin main
```

#### 2. Vercelでプロジェクトをインポート

1. [Vercel](https://vercel.com)にアクセス
2. 「Add New...」→「Project」をクリック
3. GitHubリポジトリを選択してインポート

#### 3. 環境変数を設定（重要！）

デプロイ前に、以下の環境変数を設定してください：

1. Vercelのプロジェクト設定画面で「Settings」→「Environment Variables」を開く
2. 以下の環境変数を追加:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` |

**⚠️ 注意**: これらの環境変数を設定しないと、ビルドエラーが発生します。

3. 環境変数の適用範囲を選択:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

#### 4. デプロイ

「Deploy」ボタンをクリックすると、自動的にビルドとデプロイが開始されます。

#### 5. デプロイ後の設定

デプロイが完了したら、SupabaseのダッシュボードでリダイレクトURLを設定してください:

1. Supabaseダッシュボード → Authentication → URL Configuration
2. 「Site URL」にVercelのURL（例: `https://your-app.vercel.app`）を設定
3. 「Redirect URLs」に以下を追加:
   - `https://your-app.vercel.app/**`
   - `http://localhost:3000/**`（開発用）

### トラブルシューティング

#### ビルドエラー: "Your project's URL and API key are required"

**原因**: 環境変数が設定されていません。

**解決方法**:
1. Vercelの「Settings」→「Environment Variables」で環境変数を追加
2. 「Deployments」タブから最新のデプロイを選択し、「Redeploy」をクリック

#### 新規登録後に確認メールが届かない

**原因**: Supabaseのメール設定が完了していません。

**解決方法（開発環境）**:
1. Supabaseダッシュボード → Authentication → Providers → Email
2. 「Confirm email」をオフにする（開発環境のみ）

**解決方法（本番環境）**:
1. Supabaseダッシュボード → Project Settings → Auth
2. カスタムSMTPを設定するか、Supabaseのデフォルトメール機能を使用

## ライセンス

MIT
