'use strict';
var vscode = require('vscode');
var path = require('path');
var child_process = require('child_process');
var Q = require('q');
var isDebug = !!process.env['OKAZUKIUML_DEBUG'];
function activate(context) {
    new OkazukiPlantUML.PlantUMLExtension(context).initialize();
}
exports.activate = activate;
function deactivate() {
}
exports.deactivate = deactivate;
var OkazukiPlantUML;
(function (OkazukiPlantUML) {
    var PlantUMLExtension = (function () {
        function PlantUMLExtension(context) {
            this.context = context;
            this.provider = new TextDocumentContentProvider();
        }
        PlantUMLExtension.prototype.initialize = function () {
            if ((!!process.env['PLANTUML_HOME'] || !!process.env['PLANTUML_JAR']) && !!process.env['JAVA_HOME']) {
                this.registerTextProvider();
                this.registerCommands();
                this.registerDocumentChangedWatcher();
            }
            else {
                if (!process.env['PLANTUML_HOME'] || !process.env['PLANTUML_JAR']) {
                    vscode.window.showErrorMessage('Set enviroment variable. PLANTUML_HOME or PLANTUML_JAR.');
                }
                if (!process.env['JAVA_HOME']) {
                    vscode.window.showErrorMessage('Set enviroment variable. JAVA_HOME.');
                }
            }
        };
        PlantUMLExtension.prototype.registerTextProvider = function () {
            var registration = vscode.workspace.registerTextDocumentContentProvider('plantuml-preview', this.provider);
            this.context.subscriptions.push(registration);
        };
        PlantUMLExtension.prototype.registerCommands = function () {
            var _this = this;
            var disposable = vscode.commands.registerCommand('extension.previewPlantUML', function () {
                var editor = vscode.window.activeTextEditor;
                return vscode.commands.executeCommand('vscode.previewHtml', TextDocumentContentProvider.previewUri, vscode.ViewColumn.Two, 'PlantUML Preview')
                    .then(function (success) {
                    _this.provider.update(TextDocumentContentProvider.previewUri);
                    editor.show();
                }, function (reason) {
                    vscode.window.showErrorMessage(reason);
                });
            });
            var disposables = ExportCommandManager.registerExportCommands();
            (_a = this.context.subscriptions).push.apply(_a, [disposable].concat(disposables));
            var _a;
        };
        PlantUMLExtension.prototype.registerDocumentChangedWatcher = function () {
            var _this = this;
            var activeEditorChangedDisposable = vscode.window.onDidChangeActiveTextEditor(function (editor) {
                _this.provider.update(TextDocumentContentProvider.previewUri);
            });
            // update preview
            var changedTimestamp = new Date().getTime();
            var textDocumentChangedDisposable = vscode.workspace.onDidChangeTextDocument(function (e) {
                if (vscode.window.activeTextEditor.document !== e.document) {
                    return;
                }
                changedTimestamp = new Date().getTime();
                setTimeout(function () {
                    if (new Date().getTime() - changedTimestamp >= 400) {
                        _this.provider.update(TextDocumentContentProvider.previewUri);
                    }
                }, 500);
            });
            this.context.subscriptions.push(activeEditorChangedDisposable, textDocumentChangedDisposable);
        };
        return PlantUMLExtension;
    }());
    OkazukiPlantUML.PlantUMLExtension = PlantUMLExtension;
    var PlantUMLExportFormat = (function () {
        function PlantUMLExportFormat(label, format) {
            this.label = label;
            this.format = format;
        }
        return PlantUMLExportFormat;
    }());
    var PlantUML = (function () {
        function PlantUML(workDir, plantUmlText, args) {
            this.workDir = workDir;
            this.plantUmlText = plantUmlText;
            this.args = args;
        }
        PlantUML.fromTextEditor = function (editor) {
            return new PlantUML(path.dirname(editor.document.uri.fsPath), editor.document.getText().trim(), ['-p', '-tsvg']);
        };
        PlantUML.fromExportFormat = function (inputPath, format, outputPath) {
            return new PlantUML(path.dirname(inputPath), null, [inputPath, format.format, '-o', outputPath]);
        };
        PlantUML.prototype.execute = function () {
            var params = ['-Duser.dir=' + this.workDir, '-Djava.awt.headless=true', '-jar', PlantUML.plantUmlCommand];
            params.push.apply(params, this.args);
            params.push('-charset', 'utf-8');
            console.log(params);
            var process = child_process.spawn(PlantUML.javaCommand, params);
            if (this.plantUmlText !== null) {
                process.stdin.write(this.plantUmlText);
                process.stdin.end();
            }
            return Q.Promise(function (resolve, reject, notify) {
                var output = '';
                process.stdout.on('data', function (x) {
                    output += x;
                });
                process.stdout.on('close', function () {
                    resolve(output);
                });
                var stderror = '';
                process.stderr.on('data', function (x) {
                    stderror += x;
                });
                process.stderr.on('close', function () {
                    if (isDebug && !!stderror) {
                        vscode.window.showErrorMessage(stderror);
                    }
                    if (!!stderror) {
                        console.log(stderror);
                    }
                });
            });
        };
        PlantUML.plantUmlCommand = !!process.env['PLANTUML_JAR'] ?
            process.env['PLANTUML_JAR'] :
            path.join(process.env['PLANTUML_HOME'], 'plantuml.jar');
        PlantUML.javaCommand = path.join(process.env['JAVA_HOME'], 'bin', 'java');
        return PlantUML;
    }());
    // ContentProvider
    var TextDocumentContentProvider = (function () {
        function TextDocumentContentProvider() {
            this._onDidChange = new vscode.EventEmitter();
        }
        TextDocumentContentProvider.prototype.provideTextDocumentContent = function (uri) {
            return this.createPlantumlSnippet();
        };
        Object.defineProperty(TextDocumentContentProvider.prototype, "onDidChange", {
            get: function () {
                return this._onDidChange.event;
            },
            enumerable: true,
            configurable: true
        });
        TextDocumentContentProvider.prototype.update = function (uri) {
            this._onDidChange.fire(uri);
        };
        TextDocumentContentProvider.prototype.createPlantumlSnippet = function () {
            var editor = vscode.window.activeTextEditor;
            if (!(editor.document.languageId === 'plaintext' || editor.document.languageId === 'restructuredtext')) {
                return this.errorSnippet("not plaintext");
            }
            return this.extractSnippet();
        };
        TextDocumentContentProvider.prototype.extractSnippet = function () {
            var editor = vscode.window.activeTextEditor;
            return PlantUML.fromTextEditor(editor)
                .execute()
                .then(function (x) { return ("<body style=\"background-color:white;width:100%;height:100%;overflow:visible;\">" + x + "</body>"); });
        };
        TextDocumentContentProvider.prototype.errorSnippet = function (text) {
            return "<body><span>" + text + "</span></body>";
        };
        TextDocumentContentProvider.previewUri = vscode.Uri.parse('plantuml-preview://authority/plantuml-preview');
        return TextDocumentContentProvider;
    }());
    var ExportCommandManager = (function () {
        function ExportCommandManager() {
        }
        ExportCommandManager.registerExportCommands = function () {
            var disposables = [];
            ExportCommandManager.formats.forEach(function (x) {
                var d = vscode.commands.registerCommand('extension.exportPlantUML-' + x.label, function () {
                    var outputDefaultPath = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath);
                    return vscode.window.showInputBox({ value: outputDefaultPath, prompt: "output folder path" })
                        .then(function (outputPath) {
                        if (outputPath == null) {
                            // canceled
                            return Q.Promise(function (resolve, reject, notify) {
                                resolve("");
                            });
                        }
                        if (outputPath == "") {
                            // if equals to defaultvalue,outputPath is passed empty string
                            outputPath = outputDefaultPath;
                        }
                        var command = PlantUML.fromExportFormat(vscode.window.activeTextEditor.document.uri.fsPath, x, outputPath);
                        return command.execute();
                    });
                });
                disposables.push(d);
            });
            return disposables;
        };
        ExportCommandManager.formats = [
            new PlantUMLExportFormat('png', '-tpng'),
            new PlantUMLExportFormat('svg', '-tsvg'),
            new PlantUMLExportFormat('eps', '-teps'),
            new PlantUMLExportFormat('pdf', '-tpdf'),
            new PlantUMLExportFormat('vdx', '-tvdx'),
            new PlantUMLExportFormat('xmi', '-txmi'),
            new PlantUMLExportFormat('scxml', '-tscxml'),
            new PlantUMLExportFormat('html', '-thtml'),
            new PlantUMLExportFormat('txt', '-ttxt'),
            new PlantUMLExportFormat('utxt', '-tutxt'),
            new PlantUMLExportFormat('latex', '-tlatex'),
            new PlantUMLExportFormat('latex:nopreamble', '-tlatex:nopreamble'),
        ];
        return ExportCommandManager;
    }());
})(OkazukiPlantUML || (OkazukiPlantUML = {}));
//# sourceMappingURL=extension.js.map