/* Canei Subirats — recognition: a file in, text out.
 *
 * The HALF OF DOCUMENT CAPTURE THAT IS NOT DOMAIN. Turning a PDF or a
 * photograph into lines of text is infrastructure: it needs pdf.js and
 * tesseract.js, roughly 7 MB of them, and it knows nothing about invoices.
 * What those lines MEAN — which is the issuer, which the tax id, which amount
 * is the total, and whether anything actually checked them — is domain
 * knowledge and lives in `@repo/capability-extraction`, reached through
 * `ErpBridge.extraction`. Keeping the two apart is what lets the meaning be
 * tested against a jurisdiction that does not exist while this file is tested
 * against a real browser.
 *
 * THREE RULES, all from the S0b spike (`docs/CANEI-V4-OCR-SPIKE.md`):
 *
 *   1. TRY THE TEXT LAYER FIRST, ALWAYS. Most supplier quotes are digital
 *      PDFs; pdf.js read one 11/11 instantly, and for those OCR never runs.
 *   2. OCR ONLY WHERE THERE IS NOTHING TO READ. A scan, a photograph, an
 *      image, or a PDF whose pages are pictures of paper.
 *   3. NOTHING LOADS UNTIL IT IS NEEDED. Not at boot, not on the capture
 *      screen, not until a file is actually handed over — and the OCR half
 *      never at all on a document that had a text layer.
 *
 * ON SIGNAL. The bundle needs a good connection ONCE, to install. That is the
 * opposite of the site it is meant for, so `prepareOffline()` exists: an
 * explicit, user-pressed pre-fetch, on wifi, with a progress figure. Nothing
 * here ever downloads 7 MB on its own initiative.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ErpOcr = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* The global, from inside the factory. The UMD wrapper above has it, the
     factory does not — and tesseract.min.js is a classic script that hangs
     itself off the global rather than exporting anything, so this file needs
     its own handle on it. */
  var root = typeof self !== "undefined" ? self : globalThis;

  /* Resolved against THIS script's own URL, not the page's. erp.html is served
     from site/, but the iOS and Android shells load the same files through a
     different base, and journey.html sits beside it — a relative path from the
     document would break on any of them the moment one moved. */
  var HERE = (function () {
    try {
      if (typeof document !== "undefined" && document.currentScript)
        return document.currentScript.src.replace(/[^/]*$/, "");
    } catch (e) {
      /* fall through */
    }
    return "";
  })();
  var V = HERE + "vendor/";

  /** Recognition quality below which a photograph is not worth reading. */
  var MIN_PIXELS = 1_200_000; // ≈ 1,400 × 860. See "capture minimum" below.
  var OCR_LANGS = "spa+cat";

  var pdfjsP = null;
  var tessP = null;

  /* ------------------------------------------------------------------ *
   * Loading, lazily and once
   * ------------------------------------------------------------------ */

  /**
   * `Promise.withResolvers`, WHICH THE READER NEEDS AND AN OLDER PHONE LACKS.
   *
   * pdfjs-dist 6 calls it. It landed in Safari 17.4 (March 2024), Chrome 119
   * and Firefox 121 — so on an iPhone a year or two behind, `withResolvers` is
   * undefined and the whole reader dies at the first PDF with WebKit's own
   * wording for a missing method: "undefined is not a function". The operator
   * photographed exactly that, and it is the "Safari PDF crash" that sat
   * unreproduced on the parked list for three days.
   *
   * Established by experiment rather than by reading release notes: with each
   * candidate API deleted in turn, only this one breaks the path, and adding
   * these four lines back restores it. Everything downstream of pdf.js goes
   * with it — supplier-invoice capture, bank-statement import, the document
   * preview and the thumbnailer — which is why the shim lives at the single
   * door to pdf.js rather than beside any one caller.
   *
   * Native first, always: this only defines what is missing.
   */
  function ensureWithResolvers(scope) {
    if (typeof scope.Promise.withResolvers === "function") return;
    scope.Promise.withResolvers = function withResolvers() {
      var resolve, reject;
      var promise = new scope.Promise(function (res, rej) {
        resolve = res;
        reject = rej;
      });
      return { promise: promise, resolve: resolve, reject: reject };
    };
  }

  function loadPdfjs() {
    if (!pdfjsP) {
      ensureWithResolvers(root);
      pdfjsP = import(V + "pdfjs/pdf.min.mjs").then(function (m) {
        /* The WORKER is a second JavaScript realm and gets no polyfill from
           here — `pdf.worker.min.mjs` calls `withResolvers` too, and a shim
           installed on the page cannot reach it. So the worker is started
           through a wrapper of ours that installs the shim and then imports
           the real worker, which keeps the vendored file untouched (its
           MANIFEST says it is generated; hand-editing it would be undone by
           the next `tools/vendor-ocr.mjs` run and the drift would be silent). */
        m.GlobalWorkerOptions.workerSrc = HERE + "pdfjs-worker-shim.mjs";
        return m;
      });
    }
    return pdfjsP;
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () {
        res();
      };
      s.onerror = function () {
        rej(new Error("No se ha podido cargar " + src));
      };
      document.head.appendChild(s);
    });
  }

  function loadTesseract() {
    if (!tessP)
      tessP = loadScript(V + "tesseract/tesseract.min.js").then(function () {
        if (!root.Tesseract) throw new Error("Tesseract no se ha cargado");
        return root.Tesseract;
      });
    return tessP;
  }

  /* ------------------------------------------------------------------ *
   * Reading
   * ------------------------------------------------------------------ */

  /** A PDF's own text layer. Empty string when the pages are pictures. */
  function pdfText(buf) {
    return loadPdfjs().then(function (pdfjs) {
      return pdfjs
        .getDocument({ data: new Uint8Array(buf), useSystemFonts: true })
        .promise.then(function (doc) {
          var pages = [];
          var chain = Promise.resolve();
          for (var i = 1; i <= doc.numPages; i++)
            (function (n) {
              chain = chain
                .then(function () {
                  return doc.getPage(n);
                })
                .then(function (page) {
                  return page.getTextContent();
                })
                .then(function (tc) {
                  pages.push(
                    tc.items
                      .map(function (it) {
                        return it.str + (it.hasEOL ? "\n" : "");
                      })
                      .join(""),
                  );
                });
            })(i);
          return chain.then(function () {
            return { pages: pages, doc: doc };
          });
        });
    });
  }

  /** Render PDF pages to canvases, for the OCR path. */
  function pdfRaster(doc, scale) {
    var out = [];
    var chain = Promise.resolve();
    for (var i = 1; i <= doc.numPages; i++)
      (function (n) {
        chain = chain
          .then(function () {
            return doc.getPage(n);
          })
          .then(function (page) {
            var vp = page.getViewport({ scale: scale || 2 });
            var c = document.createElement("canvas");
            c.width = Math.round(vp.width);
            c.height = Math.round(vp.height);
            return page
              .render({ canvasContext: c.getContext("2d"), viewport: vp })
              .promise.then(function () {
                out.push(c);
              });
          });
      })(i);
    return chain.then(function () {
      return out;
    });
  }

  function ocr(images, onProgress) {
    return loadTesseract().then(function (T) {
      return T.createWorker(OCR_LANGS, 1, {
        workerPath: V + "tesseract/worker.min.js",
        corePath: V + "tesseract/tesseract-core-simd-lstm.js",
        langPath: V + "tessdata",
        // Never the CDN. On a bare static host it is not reachable, and on a
        // site with no signal neither is anything else — a silent fallback to
        // the network is exactly the failure this vendoring exists to prevent.
        cacheMethod: "none",
        /* Load the worker from its real URL rather than wrapping it in a blob.
           This is not a preference — without it the pipeline does not run at
           all, and it fails in a way worth recording: tesseract's default is a
           blob: worker, and the Emscripten core inside it resolves its .wasm
           against `scriptDirectory`, which a blob URL does not have. The
           result is a fetch for the bare name "tesseract-core-simd-lstm.wasm"
           with nothing to resolve it against, an "Invalid URL" from deep
           inside the wasm loader, and a promise that never settles. Loading
           the worker from vendor/tesseract/ gives the core a real directory
           and the .wasm beside it is found. */
        workerBlobURL: false,
        /* Always a function, never undefined: tesseract calls this without
           checking, so omitting it throws "m is not a function" on every
           progress tick — noisy in the console and, because the site E2E
           asserts zero console errors, a failing build. */
        logger: function (m) {
          if (onProgress && m && m.status === "recognizing text") onProgress(m.progress);
        },
      }).then(function (worker) {
        var pages = [];
        var confidences = [];
        var chain = Promise.resolve();
        images.forEach(function (img) {
          chain = chain
            .then(function () {
              return worker.recognize(img);
            })
            .then(function (r) {
              pages.push(r.data.text || "");
              confidences.push(r.data.confidence);
            });
        });
        return chain
          .then(function () {
            return worker.terminate();
          })
          .then(function () {
            return {
              pages: pages,
              confidence: confidences.length
                ? Math.round(
                    confidences.reduce(function (a, b) {
                      return a + b;
                    }, 0) / confidences.length,
                  )
                : null,
            };
          });
      });
    });
  }

  /**
   * The pixel dimensions of an image file, and nothing else.
   *
   * Deliberately returns numbers rather than the <img>: the object URL is
   * revoked the moment it has been measured, and handing the element on would
   * hand on a `src` that no longer resolves. That is not hypothetical — an
   * earlier draft did exactly that, tesseract read `img.src`, and the whole
   * pipeline died on a revoked blob: URL with `ERR_FILE_NOT_FOUND`. The File
   * itself goes to the recogniser, which needs no URL at all.
   */
  function measure(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        var out = { width: im.naturalWidth, height: im.naturalHeight };
        URL.revokeObjectURL(url);
        res(out);
      };
      im.onerror = function () {
        URL.revokeObjectURL(url);
        rej(new Error("No se ha podido leer la imagen"));
      };
      im.src = url;
    });
  }

  /** Is there enough text here to call this a digital document? */
  function meaningful(pages) {
    var joined = pages.join("").replace(/\s+/g, "");
    return joined.length >= 40;
  }

  /**
   * Read a file.
   *
   * Resolves `{ text, pages, engine, confidence, warnings, pageCount }`.
   * `engine` is "pdf-text" or "ocr" — the screen says which, because "the
   * computer read it" and "the computer guessed at a photograph" deserve
   * different amounts of trust from the person checking it.
   */
  function recognise(file, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || null;
    var warnings = [];
    var isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name || "");

    if (isPdf) {
      return file.arrayBuffer().then(function (buf) {
        return pdfText(buf).then(function (r) {
          if (meaningful(r.pages))
            return {
              text: r.pages,
              pages: r.pages,
              pageCount: r.pages.length,
              engine: "pdf-text",
              confidence: null,
              warnings: warnings,
            };
          // A PDF whose pages are pictures of paper. Rule 2.
          warnings.push("El PDF no lleva texto: se ha leído como imagen.");
          return pdfRaster(r.doc, 2).then(function (canvases) {
            return ocr(canvases, onProgress).then(function (o) {
              return {
                text: o.pages,
                pages: o.pages,
                pageCount: o.pages.length,
                engine: "ocr",
                confidence: o.confidence,
                warnings: warnings,
              };
            });
          });
        });
      });
    }

    return measure(file).then(function (dim) {
      /* THE CAPTURE MINIMUM, and it is about pixels rather than steadiness.
         The spike's angled phone photo scored 9/11 while a low-resolution
         scan managed 5/11, so resolution is the thing worth refusing on. The
         warning is a warning and not a block: a bad photograph of a document
         nobody can find again is still worth more than nothing, and the
         amber dots will say what could not be read. */
      if (dim.width * dim.height < MIN_PIXELS)
        warnings.push(
          "La imagen tiene poca resolución (" +
            dim.width +
            "×" +
            dim.height +
            "). Acérquese y repita la foto si algún dato sale en ámbar.",
        );
      return ocr([file], onProgress).then(function (o) {
        return {
          text: o.pages,
          pages: o.pages,
          pageCount: o.pages.length,
          engine: "ocr",
          confidence: o.confidence,
          warnings: warnings,
        };
      });
    });
  }

  /**
   * Pull the whole OCR runtime down now, on purpose.
   *
   * Rule 09 asks for capture where there is no signal; this bundle needs a
   * connection once to install. So the resolution is an explicit action a
   * person takes while they still have wifi — never a silent 7 MB download
   * over somebody's mobile data on a site.
   */
  function prepareOffline(onProgress) {
    var files = [
      "pdfjs/pdf.min.mjs",
      "pdfjs/pdf.worker.min.mjs",
      "tesseract/tesseract.min.js",
      "tesseract/worker.min.js",
      "tesseract/tesseract-core-simd-lstm.js",
      "tesseract/tesseract-core-simd-lstm.wasm",
      "tessdata/spa.traineddata.gz",
      "tessdata/cat.traineddata.gz",
    ];
    var done = 0;
    return Promise.all(
      files.map(function (f) {
        return fetch(V + f, { cache: "force-cache" }).then(function (r) {
          if (!r.ok) throw new Error("No se ha podido descargar " + f);
          return r.blob().then(function (b) {
            done++;
            if (onProgress) onProgress(done / files.length);
            return b.size;
          });
        });
      }),
    ).then(function (sizes) {
      return {
        files: files.length,
        bytes: sizes.reduce(function (a, b) {
          return a + b;
        }, 0),
      };
    });
  }

  return {
    recognise: recognise,
    prepareOffline: prepareOffline,
    /**
     * pdf.js, loaded once and READY TO RENDER.
     *
     * Published rather than kept private because three screens outside this
     * module open a PDF — the purchase comparison pane, the captured-document
     * pane and the evidence viewer — and each of them used to `import()` the
     * library directly. That import resolves, and then the first render
     * throws `No "GlobalWorkerOptions.workerSrc" specified`, because the
     * worker path is set HERE and nowhere else: those screens only worked at
     * all if the capture screen happened to have run first. One loader, so
     * "I have pdf.js" and "pdf.js can draw" cannot come apart again.
     */
    loadPdfjs: loadPdfjs,
    /** For a screen that wants to say what it will have to fetch. */
    vendorBase: function () {
      return V;
    },
    minPixels: MIN_PIXELS,
  };
});
