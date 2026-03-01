# Database

このディレクトリにはデータベース関連のファイルを格納します。

## ディレクトリ構造

```
database/
├── README.md                 # このファイル
├── migrations/               # マイグレーションファイル（実行順）
│   ├── 001_initial_schema.sql
│   ├── 002_add_groups.sql
│   └── 003_pivot_to_lists.sql
└── archive/                  # 開発中の修正スクリプト（参考用）
    ├── fixes/
    └── debug/
```

## マイグレーション実行手順

### 新規セットアップ
```sql
-- 1. 初期スキーマ
\i migrations/001_initial_schema.sql

-- 2. リストベース設計への移行
\i migrations/003_pivot_to_lists.sql

-- 3. マイグレーション関数実行（既存データがある場合）
SELECT migrate_categories_to_lists();
```

### 既存環境からのアップグレード
アーカイブディレクトリの修正スクリプトを必要に応じて実行してください。

## 注意事項
- 本番環境で実行する前に必ずバックアップを取得
- マイグレーションは順番に実行すること
- ロールバック手順も事前に確認
