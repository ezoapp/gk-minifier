var config = {
  paths: {},
  shim: {
    "p/gk-demo/components/flot/flot/plugins/jquery.flot.saveAsImage": {
      "deps": ["p/gk-demo/components/flot/flot/plugins/jquery.flot.tooltip"]
    },
    "p/gk-demo/components/flot/flot/plugins/jquery.flot.tooltip": {
      "deps": ["p/gk-demo/components/flot/flot/jquery.flot.canvas"]
    },
    "p/gk-demo/components/flot/flot/jquery.flot.canvas": {
      "deps": ["p/gk-demo/components/flot/flot/jquery.flot.pie"]
    },
    "p/gk-demo/components/flot/flot/jquery.flot.pie": {
      "deps": ["p/gk-demo/components/flot/flot/jquery.flot"]
    },
    "p/gk-demo/components/flot/flot/jquery.flot": {
      "deps": ["p/gk-demo/components/flot/flot/plugins/lib/canvas2image"]
    },
    "p/gk-demo/components/flot/flot/plugins/lib/canvas2image": {
      "deps": ["p/gk-demo/components/flot/flot/plugins/lib/base64"]
    },
    "p/gk-demo/components/flot/flot/plugins/lib/base64": {
      "deps": ["p/gk-demo/components/flot/flot/excanvas"]
    }
  },
  documentRoot: '/Users/mingzeke/Documents/',
  ie8: true
},
  htmls = ['p/gk-demo/components/flot/demo/flot_pie.html'];

function eachExec(arr, func, cb) {
  var i = 0,
    l = arr.length,
    next = function () {
      if (++i === l) {
        cb();
      } else {
        func(arr[i], next);
      }
    };
  func(arr[i], next);
}

var bundler = require('./bundler');

eachExec(htmls, function (html, next) {
  bundler.bundle(html, config, function () {
    next();
  });
}, function () {
  console.log('done.');
});
