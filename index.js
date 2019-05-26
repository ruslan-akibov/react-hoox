// old syntax, guys. hope nobody minds
Object.defineProperty(exports, "__esModule", { value: true });
var FLAG_NAME = '__r_a_17_';
var TRIGGER_NAME = '__r_a_27_';

var TIME_LIMIT = 50;

exports.default = typeof window !== 'undefined' ? runAsModule() : runAsPlugin();

function runAsPlugin() {
    return function(args) {
        var t = args.types;

        // code 'if (window.__r_a_17_) window.__r_a_27_();'
        // todo: 'if (winodw.__r_a_17_ === true) ...' or even 'window.__r_a_17_ === true && window.__r_a_27_();'
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

        // insert 'injection' on top of any function declaration
        function functionInstrumenter(path) {
            // todo: options 'include' and 'exclude' - string regexp in json
            if (this.file.opts.filename.indexOf('node_modules') >= 0) return;

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
                // includes any functions, class methods, arrows, etc...
                Function: functionInstrumenter

                // AwaitExpression, YieldExpression --> ([(await/yield ...), window.__r_a_17_ ? window.__r_a_27_() : 0][0])
                // we still can rely on transpiler for now, but in future will need to do it as well
            }
        }
    }
}

function runAsModule() {
    var _React = typeof React !== 'undefined' ? React : require('react');

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

        if (!perfTimer) {
            // refresh aggregated 'resource usage' each second
            perfStartTime = performance.now();
            perfTimer = window.setTimeout(function() {
                perfTimer = null;

                // real-time 'resource usage' logging
                var t = Math.round(timeUsed * 100) / 100;
                console.log('react-hoox: ' + t + 'ms (' + Math.round(t) / 10 + '% vCPU, ' + Math.round(memoryUsed / 1024) + 'Kb RAM)');

                timeUsed = 0;
            }, 1000);
        }

        // delay before next calculation according to current resources usage, but not less then twice per second
        var delay = Math.max(0, Math.min(500, 1000 * (timeUsed/TIME_LIMIT) - (performance.now() - perfStartTime) ));

        window.setTimeout(function() {
            checkUpdates();

            window[FLAG_NAME] = !!sourceObjects.length;  // run instrumental listener again, if there is observers
            canSwitchOn = true;                          // or just allow to start it later
        }, delay);
    }

    // stringify observing objects and check for changes
    function checkUpdates() {
        var tStart = performance.now();

        var listenersToRender = [];
        memoryUsed = 0;

        sourceObjects.forEach(function(o) {
            var descriptor = sources.get(o);

            // calculating new hash-code
            var hashCode = stringify(
                (typeof o.__observables === 'function')
                    ? o.__observables(o)
                    : (o.__observables || o)
            );

            if (hashCode !== descriptor.hashCode) {
                Array.prototype.push.apply(listenersToRender, descriptor.listeners);
                descriptor.hashCode = hashCode;
            }

            // UTF-16, the string format used by JavaScript, uses a single 16-bit code unit to represent ...
            memoryUsed += 2 * descriptor.hashCode.length;
        });

        var tEnd = performance.now();
        timeUsed += tEnd - tStart;

        // run 'invokeRender' for each related component if changes
        listenersToRender.forEach(function(f) { f({}) });
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

        var invokeRender = null;
        try {
            // using second part of state-hook to force component re-rendering
            invokeRender = _React.useState({})[1];
        } catch (error) {}

        var runOnChanges = invokeRender || (customCallback ? function() { customCallback(source) } : null);
        var returnValue = source;

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
                hashCode: stringify(source), // calculating for new items firstly in render
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
            // todo: research is it possible "React render component/hook, but do not raise Effect" because of something
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

        // todo: research case 'data in state A -> (x) ->  data to state B -> invoke render -> data to state A -> (x)'
        //_React.useLayoutEffect(function() { });

        var tEnd = performance.now();
        timeUsed += tEnd - tStart;

        return returnValue;
    }
}
