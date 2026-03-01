# 連絡帳

家族間でシームレスに使える、セキュアな共有やることアプリケーションです。Next.js (App Router) とSupabaseで構築されています。

## 主な機能

- 🔐 **セキュアな認証**: メールアドレスとパスワードによる認証
- 📱 **モバイルファースト**: スマートフォンでの片手操作に最適化
- 📋 **リストベース管理**: 用途ごとに複数のやることリストを作成
- 🔄 **リアルタイム同期**: やることがリアルタイムに同期
- 🔒 **RLS（Row Level Security）**: リストベースの強固なアクセス制御
- 🔗 **シンプルな共有**: リンクを送るだけでリストを共有（メール招待不要）
- 👥 **柔軟な共有**: 必要なリストだけを必要な人に共有
- ⚡ **楽観的UI**: 操作後すぐに結果が反映される快適なUX
- 📂 **アコーディオン式UI**: リストを展開/折りたたみして見やすく管理

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

Supabaseのダッシュボードで、SQL Editorを開き、以下の順序でSQLを実行してください:

#### 4-1. 新規セットアップ（初めて構築する場合）

1. Supabaseダッシュボード → SQL Editor
2. `database/migrations/003_pivot_to_lists.sql`の内容をコピー&ペースト
3. 「Run」をクリックして実行

これにより、以下が作成されます:
- `task_lists`テーブル（やることリスト情報）
- `task_list_members`テーブル（リストメンバーシップ）
- `tasks`テーブル（やること情報）
- リストベースのRLSポリシー

#### 4-2. 既存アプリからの移行（旧バージョンから更新する場合）

**重要**: 既に旧バージョンのアプリを使用している場合は、このマイグレーションを実行してください。

1. SQL Editorで新しいクエリを開く
2. `database/migrations/003_pivot_to_lists.sql`の内容をコピー&ペースト
3. 「Run」をクリックして実行
4. 最後に以下のコマンドを実行して、既存データをマイグレート:

```sql
SELECT migrate_categories_to_lists();
```

これにより、既存の「お使い」「イベント」「その他」カテゴリが自動的に個別のやることリストに変換されます。

#### 4-3. 修正スクリプトの適用（必要に応じて）

開発環境で問題が発生した場合は、`database/archive/fixes/`内のスクリプトを参照してください。
本番環境では通常、マイグレーションファイル（`003_pivot_to_lists.sql`）のみで十分です。

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

### やることリストの管理

#### リストの作成
1. 「自分のやること」タブを選択
2. 「➕ 新規やることリストを追加」ボタンをクリック
3. リスト名を入力して「作成」ボタンをクリック

#### リストの共有
1. 共有したいリストの「共有」アイコンをクリック
2. 表示された招待リンクをコピー
3. LINEやメッセージで家族に送信
4. 受け取った人がリンクをクリックするとリストに参加できます

#### やることの管理
1. リストをクリックして展開
2. **追加**: やること名を入力して「追加」ボタンをクリック
3. **完了**: チェックボックスをタップして完了/未完了を切り替え
4. **削除**: ×アイコンをタップしてやることを削除

### リストの切り替え

- **自分のやること**: 自分が作成したリストが表示されます
- **誰かとやること**: 共有されているリストが表示されます

リンクを発行したリストは「誰かとやること」タブに表示されます（共有アイコン👥付き）。

## 技術スタック

- **フロントエンド**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **バックエンド**: Supabase (PostgreSQL, Realtime, Auth)
- **認証**: Supabase Auth
- **データベース**: PostgreSQL with Row Level Security (RLS)
- **デプロイ**: Vercel

## プロジェクト構造

```
.
├── app/                      # Next.js App Router
│   ├── page.tsx              # メイン画面（やることリスト一覧）
│   ├── login/
│   │   └── page.tsx          # ログイン・新規登録画面
│   └── join/
│       └── [token]/
│           └── page.tsx      # リスト参加画面
├── src/
│   └── utils/
│       └── supabase/
│           ├── client.ts     # クライアント側のSupabaseクライアント
│           ├── server.ts     # サーバー側のSupabaseクライアント
│           └── middleware.ts # ミドルウェア用のSupabaseクライアント
├── database/
│   ├── migrations/           # マイグレーションファイル（実行順）
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_groups.sql
│   │   └── 003_pivot_to_lists.sql
│   └── archive/              # 開発中の修正スクリプト（参考用）
│       ├── fixes/
│       └── debug/
├── docs/                     # ドキュメント
│   ├── TECHNICAL_DOCUMENTATION.md
│   └── PROJECT_IMPROVEMENTS.md
├── middleware.ts             # 認証ミドルウェア
└── .env.local                # 環境変数（gitignore対象）
```

## Vercelへのデプロイ

### 1. Vercelプロジェクトの作成

1. [Vercel](https://vercel.com)にログイン
2. 「Add New...」→「Project」をクリック
3. GitHubリポジトリをインポート
4. プロジェクト名を設定

### 2. 環境変数の設定

デプロイ設定画面で「Environment Variables」セクションに以下を追加:

- `NEXT_PUBLIC_SUPABASE_URL`: SupabaseプロジェクトのURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: SupabaseのAnon Key

**重要**: これらの環境変数を設定しないと、ビルドが失敗します。

### 3. デプロイ

「Deploy」ボタンをクリックしてデプロイを開始します。

### 4. デプロイ後の動作確認

1. デプロイ完了後、提供されたURLにアクセス
2. `/login`でアカウントを作成
3. タスクリストを作成してタスクを追加
4. 共有リンクを発行して別のアカウントでアクセスし、共有機能をテスト

### トラブルシューティング

#### ビルドエラー: "Supabase URL and API key are required"

**原因**: 環境変数が設定されていません。

**解決方法**:
1. Vercelダッシュボード → プロジェクト → Settings → Environment Variables
2. `NEXT_PUBLIC_SUPABASE_URL`と`NEXT_PUBLIC_SUPABASE_ANON_KEY`を追加
3. 「Redeploy」をクリックして再デプロイ

#### ログイン後に「読み込み中...」のまま動かない

**原因**: データベースのRLSポリシーが正しく設定されていない可能性があります。

**解決方法**:
1. Supabase SQL Editorで`pivot_to_lists.sql`を再実行
2. RLSが有効化されていることを確認:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

#### 共有リンクが機能しない

**原因**: `task_lists`テーブルの`invite_token`が生成されていない、またはRLSポリシーの問題です。

**解決方法**:
1. ブラウザのコンソールでエラーを確認
2. Supabase → Authentication → Policies で`task_lists`と`task_list_members`のポリシーを確認
3. 必要に応じて`pivot_to_lists.sql`を再実行

## データベース構造

### task_lists（タスクリスト）

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | uuid | 主キー |
| name | text | リスト名 |
| owner_id | uuid | オーナーのユーザーID |
| is_shared | boolean | 共有フラグ |
| invite_token | text | 招待用トークン |
| created_at | timestamp | 作成日時 |

### task_list_members（リストメンバー）

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | uuid | 主キー |
| task_list_id | uuid | タスクリストID |
| user_id | uuid | ユーザーID |
| user_email | text | ユーザーのメールアドレス |
| role | text | ロール（owner/member） |
| joined_at | timestamp | 参加日時 |

### tasks（タスク）

| カラム名 | 型 | 説明 |
|---------|---|------|
| id | uuid | 主キー |
| title | text | タスク名 |
| task_list_id | uuid | 所属するタスクリストID |
| is_completed | boolean | 完了フラグ |
| user_id | uuid | 作成者のユーザーID |
| created_at | timestamp | 作成日時 |

## セキュリティ

このアプリケーションは、Supabaseの **Row Level Security (RLS)** を使用して、以下のセキュリティを実現しています:

- ユーザーは自分が作成した、または参加しているタスクリストのみを閲覧・編集できます
- タスクは所属するリストのメンバーのみがアクセス可能です
- リストのオーナーのみが招待リンクを生成できます
- すべてのデータベースアクセスはRLSポリシーによって保護されています

## ライセンス

MIT

## サポート

問題が発生した場合は、GitHubのIssuesセクションで報告してください。
