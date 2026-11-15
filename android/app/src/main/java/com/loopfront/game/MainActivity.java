package com.loopfront.game;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {

    private static final String PAGE = "file:///android_asset/index.html";
    private static final String LATEST_API = "https://api.github.com/repos/ghoshs89/loopfront/releases/latest";
    private static final String APK_URL = "https://github.com/ghoshs89/loopfront/releases/latest/download/loopfront.apk";

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#39b6e8"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setHapticFeedbackEnabled(false);
        web.setOnLongClickListener(v -> true);          // no text-selection / context menus
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                    // saved name, stars, settings
        s.setAllowFileAccess(false);                     // bundled assets still load
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;                             // the page can never navigate anywhere
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String u = request.getUrl().toString();
                if (u.startsWith("file:///android_asset/") || u.startsWith("data:") || u.startsWith("blob:")) {
                    return null;                         // bundled content only
                }
                return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
            }
        });

        web.addJavascriptInterface(new Bridge(), "LoopfrontApp");
        web.loadUrl(PAGE);
    }

    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    private void js(String code) {
        web.evaluateJavascript(code, null);
    }

    private void sendUpdateResult(final String json) {
        runOnUiThread(() -> js("window.onLoopfrontUpdate && window.onLoopfrontUpdate(" + json + ")"));
    }

    private void fetchLatest() {
        String json;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(LATEST_API).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setRequestProperty("Accept", "application/vnd.github+json");
            c.setRequestProperty("User-Agent", "Loopfront-App");
            if (c.getResponseCode() != 200) {
                throw new IllegalStateException("http " + c.getResponseCode());
            }
            StringBuilder sb = new StringBuilder();
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
            String line;
            while ((line = r.readLine()) != null) {
                sb.append(line);
            }
            r.close();
            String tag = new JSONObject(sb.toString()).optString("tag_name", "");
            int latest = Integer.parseInt(tag.replaceAll("[^0-9]", ""));
            json = "{\"status\":\"ok\",\"latest\":" + latest + ",\"current\":" + BuildConfig.VERSION_CODE + "}";
        } catch (Exception e) {
            json = "{\"status\":\"error\"}";
        } finally {
            if (c != null) {
                c.disconnect();
            }
        }
        sendUpdateResult(json);
    }

    /** The only door between the game page and the app. Methods are public and annotated for the WebView. */
    class Bridge {
        @JavascriptInterface
        public int getVersion() {
            return BuildConfig.VERSION_CODE;
        }

        @JavascriptInterface
        public void setKeepAwake(final boolean on) {
            runOnUiThread(() -> {
                if (on) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }

        @JavascriptInterface
        public void checkUpdate() {
            new Thread(MainActivity.this::fetchLatest).start();
        }

        @JavascriptInterface
        public void openDownload() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(APK_URL)));
                } catch (Exception e) {
                    sendUpdateResult("{\"status\":\"error\"}");
                }
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideBars();
        js("window.onLoopfrontResume && window.onLoopfrontResume()");
    }

    @Override
    protected void onPause() {
        js("window.onLoopfrontPause && window.onLoopfrontPause()");
        web.onPause();
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideBars();
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.onLoopfrontBack && window.onLoopfrontBack()) ? 1 : 0", value -> {
            if (!"1".equals(value)) {
                moveTaskToBack(true);
            }
        });
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
