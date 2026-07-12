# Architecture

Ryuka Landscape Designer v4.1.0 は、GitHub Pagesで配信できる静的なThree.jsアプリケーションです。

## ファイル構成

- `index.html`: HTML構造、スタイル、スクリプトの読み込み順を定義します。
- `data/fixed-site-data.js`: 測量・設計に由来する固定座標と寸法を公開し、再帰的に`Object.freeze`します。
- `js/app.js`: 描画、操作、季節・成長表現、プラン保存、データ検証を担当します。
- `vendor/three.min.js`: Three.jsランタイムです。
- `sw.js`: オフライン利用向けにアプリ資産をキャッシュします。

## 読み込み順

`three.min.js` → `fixed-site-data.js` → `app.js` の順です。`app.js`は起動直後に固定データを検証し、異常時はコンソールと画面上に警告します。

## 状態と固定データ

季節、成長年数、表示レイヤー、カメラ、PLAN A/Bは実行時状態です。これらを変更しても`window.DATA`の座標・寸法は変更しません。固定値と実行時状態を分離することで、表現改善が敷地や配置へ波及するのを防ぎます。

すべてのURLは`./`から始まる相対パスで、リポジトリ名を含むGitHub Pages配下でも動作します。
