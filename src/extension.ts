import * as vscode from "vscode";
import * as cheerio from "cheerio";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("fsePartsSnippetor.registerPartsAsSnippet", async () => {
    // ワークスペースのルートURIを取得
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("ワークスペースが開かれていないため、パーツをスニペットに登録できません");
      return;
    }

    // パーツのクラス名を取得
    const config = vscode.workspace.getConfiguration("fsePartsSnippetor");
    const targetSelector = config.get<string>("targetSelector") || "";
    const targetFilePath = config.get<string>("targetFilePath") || "";

    // ファイルのパスを定義
    const filePath = vscode.Uri.joinPath(workspaceFolders[0].uri, ...targetFilePath.split("/"));
    // スニペットファイルのパスを定義
    const snippetFilePath = vscode.Uri.joinPath(workspaceFolders[0].uri, ".vscode", "html.code-snippets");
    // 空のスニペットを定義
    const snippets: { [key: string]: { prefix: string; body: string[] } } = {};

    try {
      // ファイルの内容を読み込む
      const fileContent = await vscode.workspace.fs.readFile(filePath);

      // Unit8Arrayをstringに変換
      const fileContentString = Buffer.from(fileContent).toString("utf-8");

      // ファイルの内容をcheerioで解析
      const $ = cheerio.load(fileContentString, { xml: { xmlMode: true, decodeEntities: false } });

      const elements = $(targetSelector);
      elements.each((i, element) => {
        let elementHtml = $.html(element)?.trim();
        if (elementHtml) {
          elementHtml = elementHtml.replace(/(\$)(?=[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)/g, "\\$");

          const lines = elementHtml.split("\n");
          const indentedLines = lines.map((line, index) => {
            if (index === 0) return line; // 最初の行はインデントなし
            return "\t" + line.trim(); // VSCodeスニペット用のインデント
          });

          const snippetName = `${$(element).attr("class")}-${("0" + (i + 1)).slice(-2)}`;
          snippets[snippetName] = {
            prefix: snippetName,
            body: indentedLines,
          };
        }
      });

      // スニペットファイルを保存
      await vscode.workspace.fs.writeFile(snippetFilePath, Buffer.from(JSON.stringify(snippets, null, 2), "utf-8"));

      vscode.window.showInformationMessage("パーツをスニペットに登録しました");
    } catch (error) {
      vscode.window.showErrorMessage(`ファイルの読み込みに失敗しました: ${error}`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
