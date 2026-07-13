# Architecture

Ryuka Landscape Designer v4.6.0 は、GitHub Pagesで配信できる静的なThree.jsアプリケーションです。

## ファイル構成

- `index.html`: HTML構造、スタイル、スクリプトの読み込み順を定義します。
- `data/fixed-site-data.js`: 測量・設計に由来する固定座標と寸法を公開し、再帰的に`Object.freeze`します。
- `js/ground-materials.js`: REAL用の地表テクスチャと共有マテリアル、およびPLAN用の単色マテリアルを生成します。
- `js/building-materials.js`: 建物外観の共有PBRマテリアルとPLAN用単色材を生成します。
- `js/building-model.js`: 固定された建物寸法・開口位置からREAL/PLANモデルを構築します。
- `js/plant-materials.js`: 樹種・季節別の共有植物マテリアルを定義します。
- `js/plant-models.js`: 固定樹木データから樹種別の幹・枝・葉・花・果実を構築します。
- `js/environment-materials.js`: 山並み、周辺樹林、路肩、接地影などの共有環境マテリアルを定義します。
- `js/environment-model.js`: 時刻連動の空・照明・環境反射、山並み、周辺樹林、道路周辺を構築します。
- `js/design-state.js`: 固定植栽に対するプラン別差分、追加植栽、移行、保存、undo / redo履歴を管理します。
- `js/plant-editor.js`: 植栽の選択、配置検証、PCドラッグ、キーボード・モバイル編集操作を担当します。
- `js/app.js`: 描画、操作、季節・成長表現、プラン保存、データ検証を担当します。
- `vendor/three.min.js`: Three.jsランタイムです。
- `sw.js`: オフライン利用向けにアプリ資産をキャッシュします。

## 読み込み順

`three.min.js` → `fixed-site-data.js` → `ground-materials.js` → `building-materials.js` → `building-model.js` → `plant-materials.js` → `plant-models.js` → `environment-materials.js` → `environment-model.js` → `design-state.js` → `plant-editor.js` → `app.js` の順です。`app.js`は起動直後に固定データを検証し、異常時はコンソールと画面上に警告します。

## 状態と固定データ

季節、成長年数、表示レイヤー、カメラ、PLAN A/Bは実行時状態です。植栽編集は既存木を`base-tree-N`で識別し、移動を`overrides`、追加木を`additions`としてプラン別に保存します。編集・読み込み・初期化のいずれも`window.DATA`へ書き込まず、初期配置は固定値から解決します。undo / redo履歴はプランごとに最大50操作です。

すべてのURLは`./`から始まる相対パスで、リポジトリ名を含むGitHub Pages配下でも動作します。
