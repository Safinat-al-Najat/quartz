import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

export default (() => {
  const ImageZoom: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    return null
  }

  ImageZoom.css = `
    .medium-zoom-overlay {
      z-index: 999;
      background: rgba(0, 0, 0, 0.8);
    }

    .medium-zoom-image {
      cursor: zoom-in;
    }

    .medium-zoom-image--opened {
      cursor: zoom-out;
      z-index: 1000;
    }
  `

  ImageZoom.afterDOMLoaded = `
    // Load Medium Zoom from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/medium-zoom@1.1.0/dist/medium-zoom.min.js';
    script.onload = function() {
      // Initialize Medium Zoom on all images
      const images = document.querySelectorAll('.page-content img, article img, main img, .content img');
      if (images.length > 0 && typeof mediumZoom !== 'undefined') {
        mediumZoom(images, {
          margin: 8,  // Much more zoom than before (was 24)
          background: 'rgba(0, 0, 0, 0.85)',
          scrollOffset: 40
        });
      }
    };
    document.head.appendChild(script);
  `

  return ImageZoom
}) satisfies QuartzComponentConstructor
