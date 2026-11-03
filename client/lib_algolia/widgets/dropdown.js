/* global instantsearch */

import {
    hasClassName,
    addClassName,
    removeClassName,
    capitalize,
} from '../util.js';
  
const CLASS_OPENED = 'ais-Dropdown--opened';
const CLASS_BUTTON = 'ais-Dropdown-button';
const CLASS_CLOSE_BUTTON = 'ais-Dropdown-close';
  
const cx = (...args) => args.filter(Boolean).join(' ');
  
export function createDropdown(
    baseWidget,
    {
        cssClasses: userCssClasses = {},
        buttonText,
        buttonClassName,
        closeOnChange,
    } = {}
) {
    // Merge class names with the default ones and the ones from user
    const cssClasses = {
        root: cx('ais-Dropdown', userCssClasses.root),
        button: cx(CLASS_BUTTON, userCssClasses.button),
        buttonRefined: cx(
            'ais-Dropdown-button--refined',
            userCssClasses.buttonRefined
        ),
        closeButton: cx(CLASS_CLOSE_BUTTON, userCssClasses.closeButton),
    };

    const makeWidget = instantsearch.widgets.panel({
        cssClasses,
        templates: {
            header: options => {
                const { widgetParams } = options;
                const nbRefinements = (options.items || []).filter(
                    item => item.isRefined
                ).length;

                let text;
                if (typeof buttonText === 'string') {
                    text = nbRefinements > 0 ? buttonText+` (${nbRefinements})` : buttonText;
                } else if (typeof buttonText === 'function') {
                    text = buttonText(options);
                } else {
                    const attribute =
                        widgetParams && widgetParams.attribute
                            ? capitalize(widgetParams.attribute)
                            : '';
                    text =
                        nbRefinements > 0 ? `${attribute} (${nbRefinements})` : attribute;
                }
  
                const classNames = [cssClasses.button];
                if (typeof buttonClassName === 'string') {
                    classNames.push(buttonClassName);
                    if ((options.items || []).find(item => item.isRefined)) {
                        classNames.push(cssClasses.buttonRefined);
                    }
                } else if (typeof buttonClassName === 'function') {
                    classNames.push(buttonClassName(options));
                    if ((options.items || []).find(item => item.isRefined)) {
                        classNames.push(cssClasses.buttonRefined);
                    }
                } else if ((options.items || []).find(item => item.isRefined)) {
                    classNames.push(cssClasses.buttonRefined);
                }
  
                return `
                    <button type="button" class="${cx(...classNames)}">
                        ${text}
                    </button>
                `;
            },
            footer: `<button type="button" class="${cssClasses.closeButton}">Apply</button>`,
        },
    })(baseWidget);
  
    return widgetParams => {
        const widget = makeWidget(widgetParams);
        let state = {};
        let rootElem, headerElem, closeButtonElem;
        let touchStartY = 0;

        const open = () => {
            addClassName(rootElem, CLASS_OPENED);
            setTimeout(() => {
                state.windowClickListener = event => {
                    if (!event.composedPath().includes(rootElem)) {
                        close();
                    }
                };
                window.addEventListener('click', state.windowClickListener);
            }, 0);
        };

        const close = () => {
            removeClassName(rootElem, CLASS_OPENED);
            window.removeEventListener('click', state.windowClickListener);
            delete state.windowClickListener;
        };

        const isOpened = () => hasClassName(rootElem, CLASS_OPENED);

        const toggle = () => {
            if (isOpened()) {
                close();
            } else {
                open();
            }
        };

        // list scroll position when the touch began (null = touch started outside the list)
        let touchStartScrollTop = null;

        const handleTouchStart = (e) => {
            touchStartY = e.touches[0].clientY;
            const list = rootElem.querySelector('.ais-RefinementList-list');
            touchStartScrollTop = list && list.contains(e.target) ? list.scrollTop : null;
        };

        const handleTouchMove = (e) => {
            if (!isOpened()) return;
            
            const list = rootElem.querySelector('.ais-RefinementList-list');
            if (!list) return;

            const scrollTop = list.scrollTop;
            const scrollHeight = list.scrollHeight;
            const height = list.clientHeight;
            
            if ((scrollTop <= 0 && e.touches[0].clientY > touchStartY) ||
                (scrollTop + height >= scrollHeight && e.touches[0].clientY < touchStartY)) {
                e.preventDefault();
            }
        };

        const handleTouchEnd = (e) => {
            const touchEndY = e.changedTouches[0].clientY;
            const diff = touchStartY - touchEndY;
            
            // Swipe down 50px+ closes the panel — but not when that swipe was scrolling
            // the option list back up (Pastel #72, Su-Anne: the list closed on release
            // whenever she scrolled up). Only a swipe that starts with the list already
            // at its top (or outside the list) dismisses.
            const scrolledList = touchStartScrollTop !== null && touchStartScrollTop > 0;
            if (isOpened() && diff < -50 && !scrolledList) {
                close();
            }
        };

        const buttonListener = event => {
            if (!event.target.matches('.' + CLASS_BUTTON)) {
                return;
            }
            toggle();
        };

        const cleanUp = () => {
            if (headerElem) {
                headerElem.removeEventListener('click', buttonListener);
            }
            if (rootElem) {
                rootElem.removeEventListener('touchstart', handleTouchStart);
                rootElem.removeEventListener('touchmove', handleTouchMove);
                rootElem.removeEventListener('touchend', handleTouchEnd);
            }
            if (state.windowClickListener) {
                window.removeEventListener('click', state.windowClickListener);
            }
        };

        return {
            ...widget,
            $$widgetType: 'cmty.facetDropdown',
            render: options => {
                if (!rootElem) {
                    rootElem = document
                        .querySelector(widgetParams.container)
                        .querySelector('.ais-Panel');

                    rootElem.addEventListener('touchstart', handleTouchStart, { passive: true });
                    rootElem.addEventListener('touchmove', handleTouchMove, { passive: false });
                    rootElem.addEventListener('touchend', handleTouchEnd, { passive: true });
                }

                if (!headerElem) {
                    headerElem = rootElem.querySelector('.ais-Panel-header');
                    headerElem.addEventListener('click', buttonListener);
                }

                if (!closeButtonElem) {
                    closeButtonElem = rootElem.querySelector('.' + CLASS_CLOSE_BUTTON);
                    closeButtonElem.addEventListener('click', close);
                }

                options.instantSearchInstance.use(() => ({
                    subscribe() {},
                    unsubscribe() {},
                    onStateChange() {
                        if (
                            isOpened() &&
                            (closeOnChange === true ||
                                (typeof closeOnChange === 'function' &&
                                    closeOnChange() === true))
                        ) {
                            close();
                        }
                    },
                }));

                return widget.render.call(widget, options);
            },
            dispose: options => {
                cleanUp();
                return widget.dispose.call(widget, options);
            },
        };
    };
}