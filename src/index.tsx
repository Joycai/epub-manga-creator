import React from 'react'
import { createRoot } from 'react-dom/client'
import { observer } from 'mobx-react'
import 'components/icon'
import './index.css'

import Header from 'components/header'
import Main from 'components/main'
import Modal, { ModalBackDrop } from 'components/modal'

import { I18nProvider } from 'i18n'
import storeMain from 'store/main'

const App = observer(() => (
  <I18nProvider lang={storeMain.ui.lang}>
    <Header />
    <Main />
    <Modal />
    <ModalBackDrop />
  </I18nProvider>
))

const container =
  document.getElementById('root') ||
  document.body.appendChild(document.createElement('div'))
if (!container.id) container.id = 'root'
const root = createRoot(container)
root.render(<App />)
