import { http } from '@google-cloud/functions-framework'
import { app } from './server.js'

http('app', app)
