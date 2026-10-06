// Optional CLI runner: node tests/run-node.js (same cases as scoring.test.html)
var cases = require('./scoring.cases.js').cases, failed = 0;
cases.forEach(function (t) {
  try { t.fn(); console.log('PASS ' + t.name); }
  catch (e) { failed++; console.log('FAIL ' + t.name + '\n     ' + e.message); }
});
console.log('\n' + (cases.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
