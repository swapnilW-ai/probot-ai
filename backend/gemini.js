export default async function handler(req, res) {

  try {

    const GEMINI_KEY =
      process.env.GEMINI_API_KEY;

    const response =
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify(
            req.body
          )
        }
      );

    const data =
      await response.json();

    return res
      .status(200)
      .json(data);

  } catch (err) {

    console.error(err);

    return res
      .status(500)
      .json({
        error:
          err.message
      });
  }
}
