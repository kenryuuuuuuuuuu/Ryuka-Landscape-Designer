# Architecture

Ryuka Landscape Designer v4.8.0 は、GitHub Pagesで配信できる静的なThree.jsアプリケーションです。

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
- `js/object-catalog.js`: 編集可能な基準設備の決定的IDと、追加可能な外構設備・家具の寸法・占有範囲を定義します。
- `js/object-models.js`: ローカル原点の親GroupにREAL/PLAN設備モデルを構築し、GLBと共有プロシージャル資源を統合します。
- `js/design-state.js`: 固定植栽・固定設備に対するプラン別差分、追加要素、移行、保存、独立したundo / redo履歴を管理します。
- `js/plant-editor.js`: 植栽の選択、配置検証、PCドラッグ、キーボード・モバイル編集操作を担当します。
- `js/object-editor.js`: 外構設備・家具の選択、OBB配置検証、PCドラッグ、キーボード・モバイル編集操作を担当します。
- `vendor/GLTFLoader.js`: Three.js r128と同revisionの公式non-module GLTFLoader（MIT）です。
- `js/asset-catalog.js`: ローカルGLBのURL、基準寸法、影、ライセンス、フォールバックを定義します。
- `js/asset-loader.js`: URL単位の非同期読込、正規化、prototype/失敗キャッシュ、共有リソースを管理します。
- `scripts/generate_demo_glbs.py`: オリジナルHIGH/LOW GLBを決定的に生成・検証します。
- `assets/models/`: 物置、ベンチ、レイズドベッド木枠のGLBとライセンス記録です。
- `js/app.js`: 描画、操作、季節・成長表現、プラン保存、データ検証を担当します。
- `vendor/three.min.js`: Three.jsランタイムです。
- `sw.js`: オフライン利用向けにアプリ資産をキャッシュします。

## 読み込み順

`three.min.js` → `GLTFLoader.js` → `fixed-site-data.js` → 既存material/model群 → `object-catalog.js` → `object-models.js` → `design-state.js` → `plant-editor.js` → `object-editor.js` → `asset-catalog.js` → `asset-loader.js` → `app.js` の順です。`app.js`は起動直後に固定データを検証し、異常時はコンソールと画面上に警告します。

## 状態と固定データ

季節、成長年数、表示レイヤー、カメラ、PLAN A/Bは実行時状態です。植栽編集は既存木を`base-tree-N`、外構編集は固定設備を`base-object-*`で識別し、移動を`overrides`、追加要素を`additions`としてプラン別に保存します。`plantLayout`と`objectLayout`は別データで、undo / redo履歴もプランごと・編集種別ごとに最大50操作です。編集・読み込み・初期化のいずれも`window.DATA`へ書き込まず、空の差分では固定値からv4.7と同じ初期配置を解決します。

外構モデルは中心がローカル原点の親Groupを持ち、移動・回転は親transformだけへ適用します。井戸・ポンプ・洗い場は1つの複合設備、パーゴラ・棚・ベンチは1つの複合設備として扱います。追加設備は削除可能ですが、固定設備は削除せず元位置へ戻せます。配置検証は回転矩形または円形footprintを使い、敷地外・建物・他設備との衝突を禁止し、園路と樹冠の重なりは警告します。

すべてのURLは`./`から始まる相対パスで、リポジトリ名を含むGitHub Pages配下でも動作します。

## ローカルGLBとフォールバック

起動時はプロシージャル施設を即時描画し、6つのGLBをバックグラウンドで読み込みます。完了通知は短いdebounceでまとめ、解決済み外構オブジェクトだけを再構築します。失敗URLは自動で無限再試行せず、簡易モデルを維持します。

REALでは3Dモデル設定がAUTOなら実効描画品質に応じてHIGH/LOWを選び、詳細ならHIGH、簡易ならプロシージャルを使います。PLANは寸法可読性を優先し、常にプロシージャル表示です。物置とベンチは全体を、レイズドベッドは木枠だけを置換するため、土と植栽は従来表現を維持します。

GLBはBoundingBoxから底面をy=0、X/Z中心を原点へ正規化し、カタログの基準寸法へ合わせます。NaN、空scene、ゼロ寸法、極端なscaleは拒否します。instanceはroot transformだけを独立させ、Geometry/Material/Textureをprototypeと共有します。共有リソースは`clearRebuildGroup()`の保護セットへ登録され、`AssetManager.disposeAll()`だけが最終破棄します。

作者・出典・ライセンスは`assets/models/README.md`とカタログへ記録します。第三者モデルを追加する場合は配布条件と改変記録を追加するまでキャッシュ対象に含めません。
