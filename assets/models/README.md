# ローカルGLBモデル

このディレクトリの6ファイルは、Ryuka Landscape Designer専用のプロジェクトオリジナル素材です。外部の第三者3D素材、画像テクスチャ、アニメーション、カメラ、ライトは含みません。

## 生成方法

リポジトリルートで `python scripts/generate_demo_glbs.py` を実行すると、Python標準ライブラリだけで全ファイルを決定的に再生成し、GLB 2.0構造とaccessor範囲を検証します。座標系はY-up、X/Z中心は原点、底面はy=0です。

| モデル | 基準寸法 X × Y × Z | HIGH | LOW |
|---|---:|---|---|
| tool-shed | 3.95 × 2.45 × 3.05m | 扉・取手・壁パネル・屋根端部 | 本体・薄い屋根・正面扉 |
| garden-bench | 1.60 × 0.50 × 0.45m | 分割座板・脚・補強材 | 一体座面・脚 |
| raised-bed-frame | 2.40 × 0.42 × 1.20m | 段差のある板・四隅支柱 | 4辺の木枠 |

ファイル名は `<asset-id>-high.glb` / `<asset-id>-low.glb` とします。将来モデルを追加する場合は、作者、出典、ライセンス、改変の有無、基準寸法、推奨ポリゴン数とファイルサイズをこの文書および `js/asset-catalog.js` に記録してください。

## ライセンス

作者: Ryuka Landscape Designer

ライセンス: Project original（本プロジェクト内での利用を目的とする）

生成元: `scripts/generate_demo_glbs.py`

軽量化目安は1ファイル150KB未満、全6ファイル合計1MB未満です。HIGH/LOWとも埋め込みPBRマテリアルのみを使い、外部ファイル参照はありません。
