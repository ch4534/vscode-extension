'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
var vscode = require('vscode');
var svgProvider_1 = require('./svgProvider');
var exportProvider_1 = require('./exportProvider');
var exec = require('sync-exec');
var fs = require('pn/fs');
var tmp = require('tmp');
var cp = require('copy-paste');
var svgexport = require('svgexport');
var path = require('path');
var phantomjs = require('phantomjs-prebuilt');
function activate(context) {
    // Check PhantomJS Binary   
    if (!fs.existsSync(phantomjs.path)) {
        exec('npm rebuild', { cwd: context.extensionPath });
        process.env.PHANTOMJS_PLATFORM = process.platform;
        process.env.PHANTOMJS_ARCH = process.arch;
        phantomjs.path = process.platform === 'win32' ?
            path.join(path.dirname(phantomjs.path), 'phantomjs.exe') :
            path.join(path.dirname(phantomjs.path), 'phantom', 'bin', 'phantomjs');
    }
    var previewUri = vscode.Uri.parse('svg-preview://authority/svg-preview');
    var provider = new svgProvider_1.SvgDocumentContentProvider();
    var registration = vscode.workspace.registerTextDocumentContentProvider('svg-preview', provider);
    vscode.workspace.onDidChangeTextDocument(function (e) {
        if (e.document === vscode.window.activeTextEditor.document && !checkNoSvg(vscode.window.activeTextEditor.document, false)) {
            provider.update(previewUri);
        }
    });
    var open = vscode.commands.registerTextEditorCommand('svgviewer.open', function (te, t) {
        if (checkNoSvg(te.document))
            return;
        provider.update(previewUri);
        return vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two)
            .then(function (s) { return console.log('done.'); }, vscode.window.showErrorMessage);
    });
    context.subscriptions.push(open);
    var saveas = vscode.commands.registerTextEditorCommand('svgviewer.saveas', function (te, t) {
        if (checkNoSvg(te.document))
            return;
        var editor = vscode.window.activeTextEditor;
        var text = editor.document.getText();
        var tmpobj = tmp.fileSync({ 'postfix': '.svg' });
        var pngpath = editor.document.uri.fsPath.replace('.svg', '.png');
        exportPng(tmpobj, text, pngpath);
    });
    context.subscriptions.push(saveas);
    var saveassize = vscode.commands.registerTextEditorCommand('svgviewer.saveassize', function (te, t) {
        if (checkNoSvg(te.document))
            return;
        var editor = vscode.window.activeTextEditor;
        var text = editor.document.getText();
        var tmpobj = tmp.fileSync({ 'postfix': '.svg' });
        var pngpath = editor.document.uri.fsPath.replace('.svg', '.png');
        creatInputBox('width')
            .then(function (width) {
            if (width) {
                creatInputBox('height')
                    .then(function (height) {
                    if (height) {
                        exportPng(tmpobj, text, pngpath, Number(width), Number(height));
                    }
                });
            }
        });
    });
    context.subscriptions.push(saveassize);
    var copydu = vscode.commands.registerTextEditorCommand('svgviewer.copydui', function (te, t) {
        if (checkNoSvg(te.document))
            return;
        var editor = vscode.window.activeTextEditor;
        var text = editor.document.getText();
        cp.copy('data:image/svg+xml,' + encodeURIComponent(text));
    });
    context.subscriptions.push(copydu);
    var exportProvider = new exportProvider_1.ExportDocumentContentProvider(context);
    vscode.workspace.registerTextDocumentContentProvider('svg-export', exportProvider);
    var makeExportUri = function (uri) { return uri.with({
        scheme: 'svg-export',
        path: uri.path + '.rendered',
        query: uri.toString()
    }); };
    vscode.workspace.onDidChangeTextDocument(function (event) {
        if (event.document === vscode.window.activeTextEditor.document) {
            exportProvider.update(makeExportUri(event.document.uri));
        }
    });
    var openexport = vscode.commands.registerCommand('svgviewer.openexport', function (uri) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(uri instanceof vscode.Uri)) {
                if (vscode.window.activeTextEditor) {
                    uri = vscode.window.activeTextEditor.document.uri;
                }
                else {
                    return;
                }
            }
            var document = yield vscode.workspace.openTextDocument(uri);
            if (checkNoSvg(document)) {
                vscode.window.showWarningMessage("Active editor doesn't show a SVG document - no properties to preview.");
                return;
            }
            return vscode.commands.executeCommand('vscode.previewHtml', makeExportUri(uri));
        });
    });
    context.subscriptions.push(openexport);
    var savedu = vscode.commands.registerCommand('svgviewer.savedu', function (args) {
        return __awaiter(this, void 0, void 0, function* () {
            var data = new Buffer(args.du.split(',')[1], 'base64');
            fs.writeFileSync(args.output, data);
            vscode.window.showInformationMessage('export done. ' + args.output);
        });
    });
    context.subscriptions.push(savedu);
}
exports.activate = activate;
function creatInputBox(param) {
    return vscode.window.showInputBox({
        prompt: "Set " + param + " of the png.",
        placeHolder: "" + param,
        validateInput: checkSizeInput
    });
}
function checkNoSvg(document, displayMessage) {
    if (displayMessage === void 0) { displayMessage = true; }
    var isNGType = !(document.languageId === 'xml') || document.getText().indexOf('</svg>') < 0;
    if (isNGType && displayMessage) {
        vscode.window.showWarningMessage("Active editor doesn't show a SVG document - no properties to preview.");
    }
    return isNGType;
}
function checkSizeInput(value) {
    return value !== '' && !isNaN(Number(value)) && Number(value) > 0
        ? null : 'Please set number.';
}
function exportPng(tmpobj, text, pngpath, w, h) {
    console.log("export width:" + w + " height:" + h);
    var result = fs.writeFile(tmpobj.name, text, 'utf-8')
        .then(function (x) {
        svgexport.render({
            'input': tmpobj.name,
            'output': pngpath + " pad " + (w || '') + (w == null && h == null ? '' : ':') + (h || '')
        }, function (err) {
            if (!err)
                vscode.window.showInformationMessage('export done. ' + pngpath);
            else
                vscode.window.showErrorMessage(err);
        });
    })
        .catch(function (e) { return vscode.window.showErrorMessage(e.message); });
}
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map