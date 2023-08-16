import './styles/index.css'
import { h } from 'vue'
import { VPVTheme } from 'vitepress-theme-vue'

export default Object.assign({}, VPVTheme, {
  Layout: () => {
    return h(VPVTheme.Layout, null, {
      //
    })
  },
})
