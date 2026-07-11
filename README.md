# Ryuka Landscape Designer v4.0.1

Ryuka石井敷地の固定座標を基準にした、畑・庭・民泊眺望の3D検討システムです。

## GitHub Pagesで公開する

1. GitHubで新しいリポジトリを作成します。推奨名: `Ryuka-Landscape-Designer`
2. このフォルダ内のファイルを、フォルダごとではなく中身がリポジトリ直下になるようアップロードします。
3. リポジトリの `Settings` → `Pages` を開きます。
4. `Build and deployment` の Source を `Deploy from a branch` にします。
5. Branchを `main`、Folderを `/(root)` にして保存します。
6. 数分後、Pages欄に表示されるURLをiPhoneのSafariで開きます。

通常のURL形式:
`https://<GitHubユーザー名>.github.io/Ryuka-Landscape-Designer/`

## iPhoneでアプリ風に使う

Safariで公開URLを開き、共有ボタン → `ホーム画面に追加` を選択します。
PWA用のmanifest、アイコン、Service Workerを同梱しています。

## 主なファイル

- `index.html`: GitHub Pagesで起動する単一HTML版
- `manifest.webmanifest`: ホーム画面追加用設定
- `sw.js`: 基本的なキャッシュ設定
- `icon.svg`: アプリアイコン
- `docs/original_v2_2.html`: 元の座標・構造を確認するための原本

## 注意

Three.jsはCDNから読み込むため、初回表示にはインターネット接続が必要です。Service Workerのキャッシュ後も、CDN側の状況によっては完全オフライン動作しない場合があります。
