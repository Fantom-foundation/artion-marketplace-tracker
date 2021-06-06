require('dotenv').config()
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const createMessage = (data) => {
  console.log(data.subject)
  let message = {}
  let event = data.event
  const artionUri = `https://artion.io/${data.nftAddress}/${data.tokenID}`
  const team = 'Artion team from Fantom Foundation'
  switch (event) {
    case 'ItemSold':
      {
        if (data.isBuyer) {
          message = {
            to: data.to,
            from: 'support.artion@fantom.foundation',
            subject: data.subject,
            text: 'artion notification',
            html: `<p>Dear ${data.alias}<p/> You have bought a new NFT item, ${data.collectionName}'s ${data.tokenName} at ${data.price} <br/> For more information, click <a href = "${artionUri}">here</a></br><br/></br><br/>  <i><sub>${team}</sub></i>`,
          }
        } else {
          message = {
            to: data.to,
            from: 'support.artion@fantom.foundation',
            subject: data.subject,
            text: 'artion notification',
            html: `<p>Dear ${data.alias}<p/> You have sold a new NFT item, ${data.collectionName}'s ${data.tokenName} at ${data.price} <br/> For more information, click <a href = "${artionUri}">here</a></br><br/></br><br/>  <i><sub>${team}</sub></i>`,
          }
        }
      }
      break
  }

  return message
}

const sendEmail = (data) => {
  let message = createMessage(data)
  sgMail.send(message).then(
    () => {
      console.log('email sent')
    },
    (error) => {
      console.log('failed to send an email')
      console.error(error)

      if (error.response) {
        console.error(error.response.body)
      }
    },
  )
}

module.exports = sendEmail
