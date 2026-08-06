# Documentation

このフォルダは、Ryuka Landscape Designerの現行モデル仕様、データ管理規則、実装構造を記録する。

## 文書の役割

| 知りたいこと | 参照先 | 正本 |
|---|---|---|
| 現在の敷地・建物・地表・植栽・設備の仕様 | [`MODEL-SPEC.md`](MODEL-SPEC.md) | 数値配列は実装データ、意味と根拠は本文書 |
| 固定値と編集データの区別、変更手順 | [`DATA-GOVERNANCE.md`](DATA-GOVERNANCE.md) | 本文書 |
| モジュール構成、状態管理、リソース管理 | [`ARCHITECTURE.md`](ARCHITECTURE.md) | 現行コードと本文書 |
| 過去の原本・参考実装 | [`references/`](references/) | 参考資料であり現行仕様ではない |
| 変更の時系列とレビュー記録 | Git履歴・Pull Request | GitHub |

## 正本の原則

- 座標、寸法、名称などの機械可読な固定値は`data/fixed-site-data.js`を正本とする。
- 編集可能な地表・設備・植栽の種類と初期配置は、各catalogと`data/fixed-site-data.js`を正本とする。
- 文書には、値の意味、座標系、設計判断、代表値、確定・暫定の区別を記録する。
- 同じ座標配列をMarkdownへ複製しない。値を変更した場合は実装、検証、関連文書を同じPRで更新する。
- 一時的な作業指示、ブランチ名、コミット手順は恒久文書へ残さない。

## 更新の目安

- 外形・配置・寸法・用途が変わった場合: `MODEL-SPEC.md`
- 固定／編集可能の境界や検証ルールが変わった場合: `DATA-GOVERNANCE.md`
- ファイル構成や実行経路が変わった場合: `ARCHITECTURE.md`

## 実装時の必須運用

新機能や仕様変更は、コードと関連文書を同じブランチ・同じPull Requestで更新して初めて完了とする。リポジトリ直下の[`AGENTS.md`](../AGENTS.md)がCodexセッション向けの必須ルールを、[Pull Requestテンプレート](../.github/pull_request_template.md)がレビュー時の確認項目を定める。

ドキュメント変更が不要な修正では、Pull Request本文に`Docs impact: なし`と理由を記載する。
