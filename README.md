# sagyo-buddy（作業バディ）

Claude がいま何をしているかを、横のパネルにキャラクターと日本語で表示する Claude Code プラグインです。

- 作業の種類に合わせてキャラクターのポーズが変わります（考え中・ファイルを読む・書く・Web検索・コマンド実行・動画レンダリング・アップロード・返事待ち・完成など）
- 「動画をレンダリングしています」のように、いまの作業を大きな日本語で表示します
- 依頼を受けてからの経過時間とステップ数、さっきまでの作業ログ（✓ 成功 / ✗ 失敗・かかった時間）を表示します
- 表示の処理で何かが失敗しても、Claude の作業自体は止まりません

パネルはセッション開始時に自動で開きます。閉じたときは `/sagyo` で開き直せます。

## インストール

ターミナルの Claude Code で:

```
/plugin install sagyo-buddy --marketplace herrorykyk-sudo/sagyo-buddy
```

シェルから:

```
claude plugin install sagyo-buddy --marketplace herrorykyk-sudo/sagyo-buddy
```

デスクトップアプリ（`/plugin` が使えない場合）: 入力欄の横の + → Plugins → Add marketplace に `herrorykyk-sudo/sagyo-buddy` → Add plugin。

非公開リポジトリの場合は、GitHub の認証（SSH キー、または `gh auth login` のあと `gh auth setup-git`）が済んでいるパソコンでのみインストールできます。

## ライセンス

MIT
