package com.caneisubirats.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.tabs.TabLayout
import org.json.JSONObject

/**
 * Premium native shell around the live web app — the Android twin of the iOS
 * app. Every screen is loaded from the web, so anything pushed to the site
 * flows into the app on the next launch or pull-to-refresh; no store update
 * is needed for content or workflow changes.
 */
class MainActivity : AppCompatActivity() {

    /**
     * Where the app points (mirrors ios Config.swift).
     *
     * The SERVER, which is the only address where the company's data lives.
     * This used to be GitHub Pages — a static copy of the same screens with no
     * database behind it — so the app rendered and saved perfectly while
     * writing to storage inside the phone, and a record entered on a laptop
     * simply was not there. Nothing reported an error, because from the app's
     * side nothing had failed.
     *
     * The trailing `/workspace/` matters: the server serves its API at the root
     * and the screens beneath that path.
     */
    private val baseUrl = "https://178-105-10-156.sslip.io/workspace/"

    /**
     * Hosts that stay inside the web view; everything else goes to the system
     * browser. DERIVED from [baseUrl] — as two independent constants, moving
     * the app meant editing both, and forgetting the second one throws every
     * tab out to Chrome, which looks like a broken app rather than a stale
     * line.
     */
    private val internalHosts = setOfNotNull(Uri.parse(baseUrl).host)
    private val userAgentMarker = "CaneiApp/1.0 (Android; native-shell)"

    /** The tabs of the app — same pages as the iOS shell. */
    private data class Tab(val title: String, val path: String)

    /**
     * The tabs, READ FROM the shared `nav.json` — never written here.
     *
     * They used to be six hardcoded SPANISH strings, while iOS carried six
     * hardcoded ENGLISH ones and the web had a third set that actually
     * translated. Three lists, two of them untranslatable, nothing forcing any
     * of them to agree: the app showed "Comercial" over a page titled
     * "Commercial" on an English device, and iOS showed "Sales" over the same
     * page. A WebView's translator cannot reach the native bar above it.
     *
     * `nav.json` is generated from SECTIONS in erp.html with every label
     * resolved through the same dictionary the web uses, and CI diffs it, so
     * renaming a section updates every surface at once.
     *
     * Read from the app's assets rather than the network: the bar is drawn
     * before the first request completes. Refreshed on every app build.
     */
    private val tabs: List<Tab> by lazy { loadTabs() }

    /** Device language, unless the operator chose one in the app. */
    private fun uiLanguage(): String {
        val chosen = getSharedPreferences("canei", MODE_PRIVATE).getString("canei_lang", null)
        if (chosen != null && chosen in listOf("es", "ca", "en")) return chosen
        val device = resources.configuration.locales[0].language.lowercase()
        return if (device in listOf("es", "ca", "en")) device else "es"
    }

    /**
     * Decode the manifest, falling back to the last known-good layout.
     *
     * The fallback is deliberate and is NOT a second source of truth: an app
     * with no tab bar is unusable, and a decode failure means a packaging
     * mistake, which should degrade to a working bar rather than a blank one.
     */
    private fun loadTabs(): List<Tab> {
        return try {
            val text = assets.open("nav.json").bufferedReader().use { it.readText() }
            val arr = JSONObject(text).getJSONArray("tabs")
            val lang = uiLanguage()
            val out = ArrayList<Tab>(arr.length())
            for (i in 0 until arr.length()) {
                val t = arr.getJSONObject(i)
                val label = t.getJSONObject("label")
                // Spanish is the hub everywhere else in this product, so it is
                // the last resort here too — never an empty tab.
                val title = if (label.has(lang)) label.getString(lang) else label.getString("es")
                out.add(Tab(title, t.getString("path")))
            }
            if (out.isEmpty()) fallbackTabs else out
        } catch (e: Exception) {
            fallbackTabs
        }
    }

    private val fallbackTabs = listOf(
        Tab("Torre", "erp.html#tower"),
        Tab("Comercial", "erp.html#leads"),
        Tab("Proyectos", "erp.html#progress"),
        Tab("Admin.", "erp.html#invoicing"),
        Tab("Maestros", "erp.html#customers"),
        Tab("Config.", "erp.html#users"),
    )

    private lateinit var webView: WebView
    private lateinit var swipe: SwipeRefreshLayout

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        // The server asks for a sign-in and answers with a session cookie. Without
        // accepting and flushing it, the app would present the login screen on
        // every single launch — the app would work, and feel broken.
        CookieManager.getInstance().setAcceptCookie(true)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true   // localStorage / IndexedDB for browser-local screens
            settings.databaseEnabled = true
            settings.setSupportZoom(false)
            settings.userAgentString = settings.userAgentString + " " + userAgentMarker
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    val url = request.url
                    return if (url.host in internalHosts) false
                    else {
                        // mailto:, tel:, external sites → hand to the system
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
                        true
                    }
                }

                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    swipe.isRefreshing = true
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    swipe.isRefreshing = false
                }
            }
        }

        swipe = SwipeRefreshLayout(this).apply {
            addView(webView)
            setOnRefreshListener { webView.reload() }
            setColorSchemeColors(getColor(R.color.canei_green))
        }
        root.addView(
            swipe,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f),
        )

        val tabBar = TabLayout(this).apply {
            tabMode = TabLayout.MODE_SCROLLABLE
            setBackgroundColor(getColor(R.color.canei_paper))
            setSelectedTabIndicatorColor(getColor(R.color.canei_green))
            setTabTextColors(getColor(R.color.canei_muted), getColor(R.color.canei_green_deep))
            tabs.forEach { t -> addTab(newTab().setText(t.title)) }
            addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
                override fun onTabSelected(tab: TabLayout.Tab) {
                    webView.loadUrl(baseUrl + tabs[tab.position].path)
                }
                override fun onTabUnselected(tab: TabLayout.Tab) {}
                override fun onTabReselected(tab: TabLayout.Tab) {
                    webView.loadUrl(baseUrl + tabs[tab.position].path)
                }
            })
        }
        root.addView(
            tabBar,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )

        setContentView(root)
        webView.loadUrl(baseUrl + tabs[0].path)
    }

    /**
     * Write the session cookie to disk before the app goes to the background.
     * Android flushes on its own schedule, so without this a cookie set minutes
     * before the app is killed can be lost — an intermittent "why am I signed
     * out again?" that is unpleasant to chase after the fact.
     */
    override fun onPause() {
        CookieManager.getInstance().flush()
        super.onPause()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
