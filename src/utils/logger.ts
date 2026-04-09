import util from 'util'

const isDev = process.env.NODE_ENV === 'development'

const CustomLogger = {
  info({ message, obj }: { message: string; obj?: any }) {
    const consoleBody = [message]
    if (obj) consoleBody.push(util.inspect(obj, { depth: null, colors: isDev }))

    console.info(...consoleBody)
  },
  error({ message, obj }: { message: string; obj?: any }) {
    const consoleBody = [message]
    if (obj) consoleBody.push(util.inspect(obj, { depth: null, colors: isDev }))

    console.error(...consoleBody)
  },
}

export default CustomLogger
