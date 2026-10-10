package com.brainbight.mobile

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/** User-enabled system back and visible page scrolling for Brainbight. */
class BrainbightAccessibilityService : AccessibilityService() {
  override fun onServiceConnected() { super.onServiceConnected(); instance = this }
  override fun onDestroy() { instance = null; super.onDestroy() }
  override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
  override fun onInterrupt() = Unit

  override fun onGesture(gestureId: Int): Boolean {
    return when (gestureId) {
      GESTURE_SWIPE_UP -> scroll(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
      GESTURE_SWIPE_DOWN -> scroll(AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)
      GESTURE_SWIPE_LEFT -> scroll(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
      GESTURE_SWIPE_RIGHT -> performGlobalAction(GLOBAL_ACTION_BACK)
      else -> false
    }
  }

  fun scroll(action: Int): Boolean {
    var node = rootInActiveWindow ?: return false
    val focus = findScrollable(node)
    if (focus != null) node = focus
    return node.performAction(action)
  }

  private fun findScrollable(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
    if (node.isScrollable) return node
    for (i in 0 until node.childCount) {
      val match = node.getChild(i)?.let { findScrollable(it) }
      if (match != null) return match
    }
    return null
  }

  companion object {
    @Volatile var instance: BrainbightAccessibilityService? = null
      private set
    fun isEnabled(context: android.content.Context): Boolean =
      (context.getSystemService(ACCESSIBILITY_SERVICE) as AccessibilityManager).getEnabledAccessibilityServiceList(AccessibilityEvent.TYPES_ALL_MASK).any {
        val serviceInfo = it.resolveInfo?.serviceInfo
        serviceInfo?.packageName == context.packageName && serviceInfo.name.endsWith("BrainbightAccessibilityService")
      }
  }
}
