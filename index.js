// old syntax, guys. hope nobody minds
Object.defineProperty(exports, "__esModule", { value: true });
var isDevMode;
try {
    isDevMode = (process.env.NODE_ENV === 'development');
} catch (error) {}

var resolvedPromise = (typeof Promise !== 'undefined' && Promise.resolve) ? Promise.resolve() : undefined;

// unique ids to use in code instrumenting
var FLAG_NAME = '__r_a_17_';
var TRIGGER_NAME = '__r_a_27_';

// humans can't see 25th frame in the cinema.
// --- R --- 40ms --- (R) --- 40ms --- R --
// so it is better to use for calculations not more than 40ms/second
var TIME_LIMIT_FREE = 32;   // ~2 frames on 60Hz
var TIME_LIMIT = 64;
var RESCUE_INPUTS = true;

// care about user - the same naming 'react-hoox' for plugin and for import
exports.default = typeof window !== 'undefined' ? runAsModule() : runAsPlugin();

function runAsPlugin() {
    return function(args) {
        var t = args.types;

        // code 'if (window.__r_a_17_) window.__r_a_27_();'
        // todo: try 'window.__r_a_17_ === true && window.__r_a_27_();'
        var injection = t.IfStatement(
            t.memberExpression(
                t.identifier('window'), t.identifier(FLAG_NAME)
            ),
            t.expressionStatement(
                t.callExpression(
                    t.memberExpression(
                        t.identifier('window'), t.identifier(TRIGGER_NAME)
                    ),
                    []
                )
            )
        );

        var skippingFiles = {};

        // insert 'injection' on top of any function declaration
        function functionInstrumenter(path) {
            if (skippingFiles[this.file.opts.filename]) return;

            var body = path.get('body');

            if (body.type !== 'BlockStatement') {
                // one-line arrow function - replace with regular block and 'return' keyword
                body.replaceWith(
                    t.BlockStatement([
                        injection,
                        t.ReturnStatement(body.node)
                    ])
                );
            } else {
                // check if already injected
                var children = body.node.body[0] ? body.node.body : [ body.node.body ];
                for (var i = 0; i < children.length; i++) {
                    var child = children[i];

                    if (child.type === 'IfStatement') {
                        if (child.test.type === 'MemberExpression') {
                            if (child.test.property.name === FLAG_NAME) {
                                return;
                            }
                        }
                    }
                }

                // and inject, if not
                body.unshiftContainer(
                    'body',
                    injection
                );
            }
        }

        return {
            visitor: {
                Program: function(path) {
                    var filename = this.file.opts.filename;

                    // skip all modules
                    if (filename.indexOf('node_modules') >= 0) {
                        skippingFiles[filename] = true;
                        return;
                    }

                    var body = path.node.body;
                    if (!body) return;

                    // find comments on top of the file
                    var firstChild = body[0] ? body[0] : body;
                    var comments = firstChild.leadingComments;
                    if (!comments) return;

                    for (var i = 0; i < comments.length; i++) {
                        var value = (comments[i].value || '').toLowerCase();

                        // skip files with comment 'react-hoox: disabled' or same on top
                        if (value.indexOf('hoox') >= 0 && value.indexOf('disable') >= 0) {
                            skippingFiles[filename] = true;
                            return;
                        }
                    }
                },

                // 'Function' includes any functions, class methods, arrows, etc...
                Function: functionInstrumenter

                // AwaitExpression, YieldExpression --> ([(await/yield ...), window.__r_a_17_ ? window.__r_a_27_() : 0][0])
                // we still can rely on transpiler for now, but in future will need to do it as well
            }
        }
    }
}

function runAsModule() {
    var _React = typeof React !== 'undefined' ? React : require('react');

    var unstable_batchedUpdates;    // batching will be default in future (17.x was found)
    try {
        var _ReactDOM = typeof ReactDOM !== 'undefined' ? ReactDOM : require('react-dom');
        unstable_batchedUpdates = _ReactDOM.unstable_batchedUpdates;
    } catch (error) {}


    var sources = new WeakMap();
    var sourceObjects = [];

    window[FLAG_NAME] = false;   // not listen to changes
    var canSwitchOn = true;      // but allow to start listening

    // we will calculate 'resource usage'
    var perfTimer = null;
    var perfStartTime;
    var timeUsed = 0;
    var memoryUsed = 0;

    // instrumented trigger '__r_a_27_'
    window[TRIGGER_NAME] = function trigger() {
        if (!window[FLAG_NAME]) return;

        window[FLAG_NAME] = false;   // don't listen (and even call) next triggers until we finish (kind of Throttle)
        canSwitchOn = false;         // can't switch on until we finish

        var postponedChecking = function() {
            checkUpdates();

            window[FLAG_NAME] = !!sourceObjects.length;  // run instrumental listener again, if there is observers
            canSwitchOn = true;                          // or just allow to start it later
        }


        if (!perfTimer) {
            // refresh aggregated 'resource usage' each second
            perfStartTime = performance.now();
            perfTimer = window.setTimeout(function() {
                var t = Math.round(timeUsed * 100) / 100;   // formatting 0.00

                // start next tick from beginning
                timeUsed = 0;
                perfTimer = null;

                // real-time 'resource usage' logging
                if (isDevMode) {
                    console.log(
                        ((t > TIME_LIMIT_FREE) ? '[!] ' : '') + 'react-hoox: ' + t + 'ms (' +
                            Math.round(t) / 10 + '% vCPU, ' + Math.round(memoryUsed / 1024) + 'Kb RAM' +
                        ')'
                    );
                }
            }, 1000);
        }

        // delay before next calculation according to current resources usage, but not less then twice per second
        var delay = Math.max(0, Math.min(500, 1000 * (timeUsed/TIME_LIMIT) - (performance.now() - perfStartTime) ));

        if (timeUsed < TIME_LIMIT_FREE || delay < 40) {   // a lot of resources / small delays
            if (resolvedPromise) {
                resolvedPromise.then(postponedChecking);
            } else {
                window.setTimeout(postponedChecking, 0);
            }
        } else {
            window.setTimeout(postponedChecking, delay);
        }
    }

    // stringify observing objects and check for changes
    function checkUpdates() {
        var tStart = performance.now();

        var listenersToRender = [];
        memoryUsed = 0;

        sourceObjects.forEach(function(o) {
            var descriptor = sources.get(o);

            // calculating new hash-code
            var hashCode = stringify(descriptor.readable ? o() : o);

            if (hashCode !== descriptor.hashCode) {
                Array.prototype.push.apply(listenersToRender, descriptor.listeners);
                descriptor.hashCode = hashCode;
            }

            // UTF-16, the string format used by JavaScript, uses a single 16-bit code unit to represent ...
            memoryUsed += 2 * descriptor.hashCode.length;
        });

        // run 'invokeRender' for each related component if changes
        function updateListeners() {
            listenersToRender.forEach(function(f) { f({}) });
        }

        var tEnd = performance.now();
        timeUsed += tEnd - tStart;


        function isInputCaptured() {
            var focused = document.activeElement;
            return !!(lastInputState && focused && lastInputState.code === (focused.tagName + focused.type));
        }

        // check and restore <input> cursor: before update
        var focusedValueBefore = null;
        var focusedValueAfter = null;
        if (isInputCaptured()) {
            focusedValueBefore = document.activeElement.value;
        }

        // this API will not be available soon
        if (unstable_batchedUpdates) {
            unstable_batchedUpdates(updateListeners);
        } else {
            updateListeners();
        }

        // check and restore <input> cursor: after update
        if (isInputCaptured()) {
            focusedValueAfter = document.activeElement.value;

            // "was updated in render to the same value which we had in input"
            // so, it's assumed "storing input values in model"
            if (
                focusedValueBefore !== null &&
                focusedValueAfter &&
                focusedValueAfter !== focusedValueBefore &&
                focusedValueAfter === lastInputState.value
            ) {
                document.activeElement.setSelectionRange(
                    lastInputState.selectionStart,
                    lastInputState.selectionEnd,
                    lastInputState.selectionDirection
                );
            }
        }

        // only one attempt. on second update it may be dangerous
        lastInputState = null;
    }

    var lastInputState = null;
    if (RESCUE_INPUTS) {
        var inputSupportedSelection = ['text', 'search', 'url', 'tel', 'password'];

        function inputCapture(e) {
            var focused = document.activeElement;

            if (
                focused &&
                (
                    (focused.tagName === 'INPUT' && inputSupportedSelection.indexOf(focused.type) >= 0) ||
                    (focused.tagName === 'TEXTAREA')
                )
            ) {
                lastInputState = {
                    value: focused.value,
                    code: focused.tagName + focused.type,

                    selectionStart: focused.selectionStart,
                    selectionEnd: focused.selectionEnd,
                    selectionDirection: focused.selectionDirection
                };
            } else {
                lastInputState = null;
            }
        }

        document.body.addEventListener('input', inputCapture, true);
    }


    // stringify - calculates 'hashCode' of provided object (JSON.stringify-like, but with circular links)
    var objectCheck = Object.prototype.toString;
    var arrayCheck = Array.prototype.toString;
    var result = [], chain = [];

    function _stringify(obj) {
        if (!obj) { // undefined, null, 0, ...
        } else if (obj.toString === objectCheck || obj.toString === arrayCheck) { // any object or array
            if (chain.indexOf(obj) > -1) { // circular link
                result.push('>');
                return;
            }

            chain.push(obj);
            result.push('{');

            for (var key in obj) {
                result.push(key);
                _stringify(obj[key]);
            }

            result.push('}');
            chain.pop();
            return;
        }

        result.push('|', obj); // primitive value (or 'negative' from If above)
    }

    function stringify(obj) {
        result = [], chain = [];

        _stringify(obj);

        return result.join('');
    }


    // entry point: a hook, will observe provided 'source' and re-render component on changes
    return function(source, customCallback) {
        var tStart = performance.now();

        if (!source) {
            return source;
        }

        var invokeRender = null;
        try {
            // using second part of state-hook to force component re-rendering
            invokeRender = _React.useState({})[1];
        } catch (error) {}

        var returnValue = source;
        var readable = !!(source.constructor && source.call && source.apply); // support Functions as data sources
        if (readable) {
            returnValue = source();
        }

        var runOnChanges = invokeRender || (
            customCallback ? function() { customCallback(readable ? source() : source) } : null
        );


        if (!runOnChanges) { // not a hook, no callback - do nothing
            return returnValue;
        }


        // run instrumental listener, if not running
        if (canSwitchOn && !window[FLAG_NAME]) {
            window[FLAG_NAME] = true;
        }

        // create new hash-code if not observing this object yet
        var descriptor = sources.get(source);
        if (!descriptor) {
            descriptor = {
                hashCode: stringify(readable ? source() : source), // calculating for new items firstly in render
                readable: readable,
                listeners: []
            }

            sources.set(source, descriptor);
            sourceObjects.push(source);
        }

        function effectHandler() {
            // React makes render -> clear effect -> use effect, so we should re-check here
            if (descriptor.listeners.indexOf(runOnChanges) < 0) {
                descriptor.listeners.push(runOnChanges);
            }

            return function() {
                // remove listener
                descriptor.listeners = descriptor.listeners.filter(function(f) { return f !==  runOnChanges });

                window.setTimeout(function() {
                    // garbage collector - remove object at all if no more listeners appears
                    if (!descriptor.listeners.length) {
                        sources.delete(source);
                        sourceObjects = sourceObjects.filter(function(o) { return o !==  source })
                    }
                }, 500);
            };
        }


        if (invokeRender) { // run as a hook
            // attach current component render listener before Effect, to catch changes between render and painting
            if (descriptor.listeners.indexOf(runOnChanges) < 0) {
                descriptor.listeners.push(runOnChanges);
            }

            // https://reactjs.org/docs/hooks-reference.html#useeffect
            // Although useEffect is deferred until after the browser has painted, it’s guaranteed to fire before any new renders.
            // React will always flush a previous render’s effects before starting a new update.
            _React.useEffect(effectHandler);
        } else if (customCallback) { // run outside React
            returnValue = effectHandler();
        }

        // https://reactjs.org/docs/hooks-reference.html#uselayouteffect
        // Updates scheduled inside useLayoutEffect will be flushed synchronously

        var tEnd = performance.now();
        timeUsed += tEnd - tStart;

        return returnValue;
    }
}
