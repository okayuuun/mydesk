# MyDesk v3 — ゲーム制作・ニュース・文章・写真・ポケモン対戦

**PWA（スマホの「ホーム画面に追加」対応）**として使う個人用Webワークスペースです。

## 利用できる機能

- 元からあった機能：タスク管理、週間チェック、サイトのお気に入り、アイデアBOX、Teams週報コピー、ゲームニュース、敬語変換
- **画像共有**：PC・スマホから画像をアップロードし、別端末で一覧・表示・ダウンロード・削除。画像はGitHub Pages上に公開せず、認証つきのRender APIから取得します。
- **ポケモン検索**：日本語の代表的なポケモン名または英語/PokeAPI IDで検索し、PokeAPIからタイプ・種族値等を表示。
- **採用率の検索**：Pokémon Champions Battle DataのAPIから、シングル・ダブル別の採用率（わざ・もちもの・能力P等）を取得。**Render APIにログイン後**の機能です。
- **ダメージ簡易計算**：Pokémon Championsのレベル50・能力ポイント（1能力最大32、合計66）、性格補正、能力ランク±6、わざ威力、タイプ相性、晴れ雨、範囲技、急所、やけど、壁、一部道具。**特性・一部の持ち物、特殊技、厳密な端数処理などは未対応**で、確定数として信用しないでください。
- **計算履歴**：計算時の攻撃側・防御側・技・配分・補正・結果を記録。攻撃側・防御側・両方・どちらかの一致で検索でき、条件を再表示できます。履歴は通常のJSONバックアップと同期対象。

## 使い始める

1. `SETUP_GUIDE_JA.md` を開く。GitHub Pagesの公開手順とRender・Neonの接続方法を記載。
2. ZIPの**中身**をGitHubのリポジトリ直下に配置（`extras.js`を含む）。
3. GitHub Pagesのデプロイ元は GitHub Actions。ニュース取得＋公開を実行。
4. 共有機能を使う場合は、`server/`をRenderのWeb Serviceとして稼働させ、Neon PostgreSQLを設定。
5. PCとスマホの同じ公開URLを開き、それぞれから同期APIにログイン。

## 大事な制約・未実装

- **クラウド同期や画像アップロードは公開しただけでは動きません**。RenderとNeonの接続が必要です。
- 画像は1枚約1.4MB、最大50枚、合計35MB。JPEG/PNG/WebPに対応。**JSONバックアップには画像本体を含みません**。原本は別途保管してください。
- 画像はNeon PostgreSQLに保存する個人用の簡易構成です。DBの容量・料金、通信量に注意してください。専門的な写真ストレージではありません。
- Pokémon Championsのメガシンカなど、PokeAPIに未登録のフォルムは検索できない場合があります。日本語名の候補は代表的なもののみ収録し、英語名・PokeAPI IDを入力する方法も使えます。
- 採用率は第三者の公開APIに依存します。APIへのアクセス失敗、データ未更新、当該シーズン未収録時には表示できません。**取得日時＝集計日時ではありません。**
- ダメージ計算は**検討用の概算**。状態異常、特性、メガシンカ、持ち物、急所、壁、範囲補正等の完全な一致を保証しません。
- Teamsの自動投稿・プッシュ通知は未実装（週報をコピーして投稿）。AI敬語には別途API設定が必要。
- 写真やクラウドデータは秘密のログイン情報で保護します。共有パスワードを人に教えたり、DB接続文字列をGitHubへアップロードしたりしないでください。

## 出典 / クレジット

- ポケモンの基礎データ： [PokeAPI](https://pokeapi.co/)
- 対戦データ：**Battle data provided by [Pokémon Champions Battle Data](https://championsbattledata.com/)**（非公式）。配布条件は[API Rules](https://championsbattledata.com/api-rules/)を参照。
- 能力ポイントとダメージの基本式： [Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Stat_point) / [Pokémon Champions向け計算の参考](https://pokechamp.elggum.com/mechanics/damage-formula/)

このサイトはポケモンの権利者・運営会社とは無関係な非公式個人用ツールです。
