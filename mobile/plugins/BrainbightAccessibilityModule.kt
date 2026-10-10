package com.brainbight.mobile

import android.provider.Settings
import android.text.TextUtils
import android.view.accessibility.AccessibilityNodeInfo
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

class BrainbightAccessibilityModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "BrainbightAccessibility"

  @ReactMethod fun isEnabled(promise: Promise) {
    promise.resolve(BrainbightAccessibilityService.isEnabled(reactApplicationContext))
  }

  @ReactMethod fun goBack(promise: Promise) {
    val service = BrainbightAccessibilityService.instance
    promise.resolve(service?.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK) ?: false)
  }

  @ReactMethod fun scroll(direction: String, promise: Promise) {
    val service = BrainbightAccessibilityService.instance
    val action = when (direction) {
      "down" -> AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
      "up" -> AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
      "left" -> AccessibilityNodeInfo.ACTION_SCROLL_LEFT
      "right" -> AccessibilityNodeInfo.ACTION_SCROLL_RIGHT
      else -> { promise.reject("INVALID_DIRECTION", "Direction must be up, down, left or right."); return }
    }
    promise.resolve(service?.scroll(action) ?: false)
  }
}

class BrainbightAccessibilityPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(BrainbightAccessibilityModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
