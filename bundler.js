+(function () {

  'use strict';

  var runMode = '.min';

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

  var requirejs = require('requirejs'),
    csso = require('csso'),
    $ = require('cheerio'),
    uglifyjs = require('uglify-js'),
    _ = require('underscore'),
    path = require('path'),
    fs = require('fs'),
    gkLoaderDir = './node_modules/gk-loader',
    utils = require(gkLoaderDir + '/lib/utils'),
    normalize = utils.normalize,
    absolute = utils.absolute,
    trimExt = utils.trimExt,
    secRegex = /<!--\s*minify_start\s*(\{.*\})\s*-->([\s\S]*?)<!--\s*minify_end\s*-->/,
    pageSecRegex = /<!--\s*minify_start\s*(\{.*\})\s*-->([\s\S]*?)<!--\s*minify_end\s*-->/g,
    bundlers = {},
    config = {};

  function bundle(html, masterConfig, cb) {
    var sections = [],
      writeSections = [],
      htmlPath = path.resolve(masterConfig.documentRoot + '/' + html),
      htmlContent = fs.readFileSync(htmlPath) + '',
      tmp;
    _.extend(config, masterConfig);
    console.log('[html] ' + htmlPath);
    while (tmp = pageSecRegex.exec(htmlContent)) {
      sections.push({
        elements: $('<div>' + tmp[2] + '</div>').children(),
        param: JSON.parse(tmp[1])
      });
    }
    eachExec(sections, function (section, next) {
      bundleSection(html, section.elements, section.param, function (writeSec) {
        writeSections.push(writeSec);
        next();
      });
    }, function () {
      replaceHTML(html, writeSections, function () {
        cb();
      });
    });
  }

  function bundleSection(html, elements, param, cb) {
    var code = '',
      tagName,
      invoker;
    if (elements.length) {
      tagName = elements[0].name.toLowerCase();
    }
    eachExec(elements, function (ele, next) {
      if (ele.name.toLowerCase() === tagName && (invoker = bundlers[tagName])) {
        invoker.apply(null, [html, $(ele), param,
          function (secCode, secMsg) {
            code += secCode;
            console.log('[source] ' + secMsg);
            next();
          }
        ]);
      } else {
        console.warn('Cannot Bundle Element: ' + $.html(ele));
        next();
      }
    }, function () {
      var replaceText = getReplaceText(html, tagName, param, code);
      console.log('[replace] ' + replaceText);
      cb(replaceText);
    });
  }

  function getReplaceText(html, tagName, param, code) {
    var currloc = normalize(config.documentRoot + '/' + html + '/../'),
      ver = param.version || new Date().toISOString().replace(/[T\-:]/g, '').substr(0, 12),
      makeAttributes = function (attrMap) {
        return _.map(attrMap, function (val, key) {
          return ' ' + key + '="' + val + '"';
        }).join('');
      };
    switch (tagName) {
    case 'script':
      fs.writeFileSync(path.resolve(currloc + '/' + param.src), code);
      param.src = param.src + '?v=' + ver;
      delete param.version;
      return '<script' + makeAttributes(param) + '></script>';
    case 'link':
      param.rel = 'stylesheet';
      fs.writeFileSync(path.resolve(currloc + '/' + param.href), code);
      param.href = param.href + '?v=' + ver;
      delete param.version;
      return '<link' + makeAttributes(param) + '>';
    default:
      return '';
    }
  }

  function replaceHTML(html, writeSections, cb) {
    var htmlPath = config.documentRoot + '/' + html,
      htmlContent = fs.readFileSync(path.resolve(htmlPath)) + '',
      count = 0,
      tmp;
    while (tmp = secRegex.exec(htmlContent)) {
      htmlContent = htmlContent.replace(secRegex, writeSections[count++]);
    }
    fs.writeFileSync(htmlPath, htmlContent);
    cb();
  }

  bundlers.script = function (html, $ele, param, cb) {
    var currloc = normalize(config.documentRoot + '/' + html + '/../'),
      src = $ele.attr('src');
    if (src) {
      if (src.match(/\/gk-loader.*\.js$/)) {
        var loadComponents = getLoadComponents(html, $ele[0].attribs),
          pluginBase = normalize(html + '/../' + src + '/../../'),
          info = _.extend({
            baseUrl: config.documentRoot,
            optimize: 'uglify2',
            preserveLicenseComments: false,
            findNestedDependencies: true,
            optimizeCss: 'node',
            nodeRequire: require,
            include: [pluginBase + '/require-text/text' + runMode].concat(loadComponents.paths),
            map: {
              '*': {
                '@css': pluginBase + '/require-css/css' + runMode,
                '@text': pluginBase + '/require-text/text' + runMode,
                '@html': pluginBase + '/gk-loader/html' + runMode,
                '@wdgt': pluginBase + '/gk-loader/wdgt' + runMode
              }
            },
            out: path.resolve(currloc + '/' + new Date().getTime() + '.js'),
            wrap: {
              end: getLoaderScriptContent()
            }
          }, config);
        overwriteMethod(requirejs.s.contexts._);
        requirejs.optimize(info, function (buildResponse) {
          if (loadComponents.components) {
            param.components = param.components ? ',' : '' + loadComponents.components;
          }
          if (loadComponents.gkTags) {
            param['gk-tags'] = param['gk-tags'] ? ',' : '' + loadComponents.gkTags;
          }
          param.pluginBase = pluginBase;
          if ($ele.attr('init')) {
            param.init = $ele.attr('init');
          }
          if ($ele.attr('callback')) {
            param.callback = $ele.attr('callback');
          }
          cb(fs.readFileSync(info.out) + '', info.out + ', components=' + JSON.stringify(info.include) + '\n' + buildResponse.trim() + '\n----------------');
          fs.unlinkSync(info.out);
        }, function (err) {
          console.error(err);
        });
      } else {
        cb(uglifyjs.minify(path.resolve(currloc + '/' + src)).code, src);
      }
    } else {
      var content = uglifyjs.minify($ele.text(), {
        fromString: true
      }).code;
      cb(content, content);
    }
  };

  function getLoadComponents(html, attribs) {
    var tagSplit = /[\s,]+/,
      attrs = {
        components: attribs.components,
        gkTags: attribs['gk-tags'],
        baseUrl: attribs.baseurl
      },
      param = {
        components: attrs.components ? attrs.components.split(tagSplit) : '',
        gkTags: attrs.gkTags ? attrs.gkTags.split(tagSplit) : '',
        baseUrl: attrs.baseUrl
      },
      paths = [],
      loadComponents = [],
      loadGkTags = [],
      currDir = html + '/../',
      baseUrl = absolute(param.baseUrl || '', currDir);
    _.each(param.components, function (c) {
      c = absolute(trimExt(c, 'html'), baseUrl);
      loadComponents.push(path.relative(currDir, c));
      paths.push('@html!' + c);
    });
    _.each(param.gkTags, function (t) {
      t = absolute(trimExt(t, 'js'), baseUrl);
      loadGkTags.push(path.relative(currDir, t));
      paths.push(t);
    });
    return {
      paths: paths,
      components: loadComponents.length ? loadComponents : '',
      gkTags: loadGkTags.length ? loadGkTags : ''
    };
  }

  function getLoaderScriptContent() {
    return fs.readFileSync(__dirname + '/' + gkLoaderDir + '/gk-loader' + runMode + '.js') + '';
  }

  function overwriteMethod(ctx) {
    var origLoad = ctx.load;
    ctx.load = function (id, url) {
      return origLoad.apply(ctx, [id, url.split('.').pop() === 'js' ? url : url + '.js']);
    };
  }

  bundlers.link = function (html, $ele, param, cb) {
    var currloc = normalize(config.documentRoot + '/' + html + '/../'),
      href = $ele.attr('href');
    cb(csso.justDoIt(fs.readFileSync(path.resolve(currloc + '/' + href)) + ''), href);
  };

  module.exports.bundle = bundle;

}(this));
