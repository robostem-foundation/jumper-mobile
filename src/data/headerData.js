/**
 * Static Header Data
 * 
 * This file contains the live header configuration shown to all users.
 * Supports both flat links and dropdown menus with children.
 */

export const headerData = {
    logoUrl: '/logo.png',
    navLinks: [
        {
            text: 'About',
            children: [
                { text: 'How', href: 'https://robostem.org/#how' },
                { text: 'What', href: 'https://robostem.org/#what' },
                { text: 'Who', href: 'https://robostem.org/#who' }
            ]
        },
        {
            text: 'Tools',
            children: [
                { text: 'Jumper', href: 'https://jumper.robostem.org' }
            ]
        },
        { text: 'Join Us / Contact', href: 'https://robostem.org/contact/' }
    ],
    lastUpdated: '2026-01-04'
};
