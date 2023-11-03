import { Switchboard } from '@superset-ui/switchboard';
import {
  DASHBOARD_UI_FILTER_CONFIG_URL_PARAM_KEY,
  IFRAME_COMMS_MESSAGE_TYPE
} from './const';
import { getGuestTokenRefreshTiming } from './guestTokenRefresh';
import { applyReplaceChildrenPolyfill } from './polyfills';

/**
 * The function to fetch a guest token from your Host App's backend server.
 * The Host App backend must supply an API endpoint
 * which returns a guest token with appropriate resource access.
 */
export type GuestTokenFetchFn = () => Promise<string>;

export type UiConfigType = {
  hideTitle?: boolean
  hideTab?: boolean
  hideChartControls?: boolean
  filters?: {
    [key: string]: boolean | undefined
    visible?: boolean
    expanded?: boolean
  }
}

export type EmbedDashboardParams = {
  /** The id provided by the embed configuration UI in Superset */
  id: string
  /** The domain where Superset can be located, with protocol, such as: https://abc123.us1a.preset.io */
  supersetDomain: string // todo remove this option? after migrating to the preset frontend sdk
  /** The html element within which to mount the iframe */
  mountPoint: HTMLElement
  /** A function to fetch a guest token from the Host App's backend server */
  fetchGuestToken: GuestTokenFetchFn
  /** The dashboard UI config: hideTitle, hideTab, hideChartControls, filters.visible, filters.expanded **/
  dashboardUiConfig?: UiConfigType
  /** Enables extra logging */
  debug?: boolean
}

export type Size = {
  width: number, height: number
}

export type EmbeddedDashboard = {
  getScrollSize: () => Promise<Size>
  unmount: () => void
}

/**
 * Embeds a Superset dashboard into the page using an iframe.
 */
export async function embedDashboard({
  id,
  supersetDomain,
  mountPoint,
  fetchGuestToken,
  dashboardUiConfig,
  debug = false
}: EmbedDashboardParams): Promise<EmbeddedDashboard> {
  function log(...info: unknown[]) {
    if (debug) {
      console.debug(`[preset-frontend-sdk][dashboard ${id}]`, ...info);
    }
  }

  log('embedding');
  // Polyfill replaceChildren
  applyReplaceChildrenPolyfill()

  if (supersetDomain.endsWith("/")) {
    supersetDomain = supersetDomain.slice(0, -1);
  }

  function calculateConfig() {
    let configNumber = 0
    if(dashboardUiConfig) {
      if(dashboardUiConfig.hideTitle) {
        configNumber += 1
      }
      if(dashboardUiConfig.hideTab) {
        configNumber += 2
      }
      if(dashboardUiConfig.hideChartControls) {
        configNumber += 8
      }
    }
    return configNumber
  }

  async function mountIframe(): Promise<Switchboard> {
    return new Promise(resolve => {
      const iframe = document.createElement('iframe');
      const dashboardConfig = dashboardUiConfig ? `?uiConfig=${calculateConfig()}` : ""
      const filterConfig = dashboardUiConfig?.filters || {}
      const filterConfigKeys = Object.keys(filterConfig)
      const filterConfigUrlParams = filterConfigKeys.length > 0
        ? "&"
        + filterConfigKeys
          .map(key => DASHBOARD_UI_FILTER_CONFIG_URL_PARAM_KEY[key] + '=' + filterConfig[key]).join('&')
        : ""

      // setup the iframe's sandbox configuration
      iframe.sandbox.add("allow-same-origin"); // needed for postMessage to work
      iframe.sandbox.add("allow-scripts"); // obviously the iframe needs scripts
      iframe.sandbox.add("allow-presentation"); // for fullscreen charts
      iframe.sandbox.add("allow-downloads"); // for downloading charts as image
      iframe.sandbox.add("allow-top-navigation"); // for links to open
      iframe.sandbox.add("allow-forms"); // for forms to submit
      iframe.sandbox.add("allow-popups"); // for exporting charts as csv 

      // add the event listener before setting src, to be 100% sure that we capture the load event
      iframe.addEventListener('load', () => {
        const switchboard = _initComms(iframe.contentWindow!, supersetDomain, debug);
        log('sent message channel to the iframe');
        resolve(switchboard);
      });

      iframe.src = `${supersetDomain}/embedded/${id}${dashboardConfig}${filterConfigUrlParams}`;
      mountPoint?.replaceChildren(iframe);
      log('placed the iframe')
    });
  }

  const [guestToken, ourPort] = await Promise.all([
    fetchGuestToken(),
    mountIframe(),
  ]);

  ourPort.emit('guestToken', { guestToken });
  log('sent guest token');

  let refreshGuestTokenInterval;
  async function refreshGuestToken() {
    const newGuestToken = await fetchGuestToken();
    ourPort.emit('guestToken', { guestToken: newGuestToken });
    refreshGuestTokenInterval = setTimeout(refreshGuestToken, getGuestTokenRefreshTiming(newGuestToken));
  }

  refreshGuestTokenInterval = setTimeout(refreshGuestToken, getGuestTokenRefreshTiming(guestToken));

  function unmount() {
    log('unmounting');
    mountPoint?.replaceChildren();
    clearInterval(refreshGuestTokenInterval);
  }

  const getScrollSize = () => ourPort.get<Size>('getScrollSize');

  return {
    getScrollSize,
    unmount,
  };
}

export function _initComms(window: Window, targetOrigin: string, debug = false) {
  // MessageChannel allows us to send and receive messages smoothly between our window and the iframe
  // See https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API
  const commsChannel = new MessageChannel();
  const ourPort = commsChannel.port1;
  const theirPort = commsChannel.port2;

  // Send one of the message channel ports to the iframe to initialize embedded comms
  // See https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
  // we know the content window isn't null because we are in the load event handler.
  window.postMessage(
    { type: IFRAME_COMMS_MESSAGE_TYPE, handshake: "port transfer" },
    targetOrigin,
    [theirPort],
  )

  // return our port from the promise
  return new Switchboard({ port: ourPort, name: 'preset-frontend-sdk', debug });
}
