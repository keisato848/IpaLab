'use client';

import { useEffect } from 'react';
import styles from './AdBanner.module.css';

// Window型の拡張
declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdBannerProps {
  /**
   * Google AdSense データ広告スロット ID
   * 例: "1234567890"
   */
  dataAdSlot: string;
  /**
   * 広告の形式
   * - 'auto': 自動サイズ（レスポンシブ）
   * - 'horizontal': 横長バナー
   * - 'vertical': 縦長バナー
   * - 'rectangle': 正方形
   */
  dataAdFormat?: 'auto' | 'horizontal' | 'vertical' | 'rectangle';
  /**
   * レスポンシブ広告を有効にするか
   */
  dataFullWidthResponsive?: boolean;
  /**
   * カスタムクラス名
   */
  className?: string;
}

/**
 * Google AdSense 広告バナーコンポーネント
 * 
 * 使用例:
 * <AdBanner dataAdSlot="1234567890" dataAdFormat="auto" />
 */
export default function AdBanner({
  dataAdSlot,
  dataAdFormat = 'auto',
  dataFullWidthResponsive = true,
  className = '',
}: AdBannerProps) {
  const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  useEffect(() => {
    // AdSenseクライアントIDが設定されている場合のみ広告をロード
    if (adClient && typeof window !== 'undefined') {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        console.error('AdSense広告の読み込みに失敗しました:', error);
      }
    }
  }, [adClient]);

  // AdSenseクライアントIDが設定されていない場合は何も表示しない
  if (!adClient) {
    return null;
  }

  return (
    <div className={`${styles.adContainer} ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adClient}
        data-ad-slot={dataAdSlot}
        data-ad-format={dataAdFormat}
        data-full-width-responsive={dataFullWidthResponsive ? 'true' : 'false'}
      />
    </div>
  );
}
