'use strict';
var vscode = require('vscode');
var SvgDocumentContentProvider = (function () {
    function SvgDocumentContentProvider() {
        this._onDidChange = new vscode.EventEmitter();
    }
    SvgDocumentContentProvider.prototype.provideTextDocumentContent = function (uri) {
        return this.createSvgSnippet();
    };
    Object.defineProperty(SvgDocumentContentProvider.prototype, "onDidChange", {
        get: function () {
            return this._onDidChange.event;
        },
        enumerable: true,
        configurable: true
    });
    SvgDocumentContentProvider.prototype.update = function (uri) {
        this._onDidChange.fire(uri);
    };
    SvgDocumentContentProvider.prototype.createSvgSnippet = function () {
        return this.extractSnippet();
    };
    SvgDocumentContentProvider.prototype.extractSnippet = function () {
        var editor = vscode.window.activeTextEditor;
        var text = editor.document.getText();
        return this.snippet(text);
    };
    SvgDocumentContentProvider.prototype.errorSnippet = function (error) {
        return "\n                <body>\n                    " + error + "\n                </body>";
    };
    SvgDocumentContentProvider.prototype.snippet = function (properties) {
        var showTransGrid = vscode.workspace.getConfiguration('svgviewer').get('transparencygrid');
        var transparencyGridCss = '';
        if (showTransGrid) {
            transparencyGridCss = "\n<style type=\"text/css\">\n.svgbg svg {\n  background:initial;\n  background-image: url(data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAAeUlEQVRYR+3XMQ4AIQhEUTiU9+/hUGy9Wk2G8luDIS8EMWdmYvF09+JtEUmBpieCJiA96AIiiKAswEsik10JCCIoCrAsiGBPOIK2YFWt/knOOW5Nv/ykQNMTQRMwEERQFWAOqmJ3PIIIigIMahHs3ahZt0xCetAEjA99oc8dGNmnIAAAAABJRU5ErkJggg==);\n  background-position: left,top;\n}\n</style>";
        }
        return "<!DOCTYPE html><html><head>" + transparencyGridCss + "</head><body><div class=\"svgbg\">" + properties + "</div></body></html>";
    };
    return SvgDocumentContentProvider;
}());
exports.SvgDocumentContentProvider = SvgDocumentContentProvider;
//# sourceMappingURL=svgProvider.js.map