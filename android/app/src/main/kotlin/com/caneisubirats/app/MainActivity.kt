package com.caneisubirats.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.tabs.TabLayout

/**
 * Premium native shell around the live web app — the Android twin of the iOS
 * app. Every screen is loaded from the web, so anything pushed to the site
 * flows into the app on the next launch or pull-to-refresh; no store update
 * is needed for content or workflow changes.
 */
class MainActivity : AppCompatActivity() {

    /** Single switch between the dev preview and production (mirrors ios Config.swift). */
    private val baseUrl = "https://stefangruber001.github.io/OpenProject2/preview/"
    // Production: "https://stefangruber001.github.io/OpenProject2/"

    private val internalHosts = setOf("stefangruber001.github.io")
    private val userAgentMarker = "CaneiApp/1.0 (Android; native-shell)"

    /** The tabs of the app — same pages as the iOS shell. */
    private data class Tab(val title: String, val path: String)
    private val tabs = listOf(
        Tab("Inicio", "index.html"),
        Tab("Proyecto", "journey.html"),
        Tab("Clientes", "clientes.html"),
        Tab("Torre", "dashboard.html"),
        Tab("Maestros", "master-data.html"),
        Tab("Finanzas", "financial-data.html"),
        Tab("Guía", "setup-guide.html"),
    )

    private lateinit var webView: WebView
    private lateinit var swipe: SwipeRefreshLayout

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true   // IndexedDB — the ERP dataset lives here
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

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
