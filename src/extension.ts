// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import hql from './language/hivesql';


// 插件入口
export function activate(context: vscode.ExtensionContext) {

	// 注册命令
	let disposable = vscode.commands.registerCommand('sql.format', () => {
		// 读取当前文件
		let queryA  =  vscode.window.activeTextEditor.document.getText();
		let languageId = vscode.window.activeTextEditor.document.languageId;
		let end:number = vscode.window.activeTextEditor.document.lineCount;
		let lenEnd:number = vscode.window.activeTextEditor.document.lineAt(end-1).text.length

		if (languageId.toLowerCase().includes("sql")){
			let cfg={language:'sql',uppercase:false,linesBetweenQueries:0}
			vscode.window.activeTextEditor.edit(
				editBuilder=>{
					let text = new hql(cfg).format(queryA)
					editBuilder.replace(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(end, lenEnd)), text);
				}
			)
		};
		
			
		vscode.window.showInformationMessage("format-success");
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
